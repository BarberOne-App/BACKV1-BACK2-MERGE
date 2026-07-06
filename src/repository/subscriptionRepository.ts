import prisma from "../database/database.js";
import { badRequest } from "../errors/index.js";

const SUB_INCLUDE = {
  users: { select: { id: true, name: true, email: true, phone: true, cpf: true } },
  subscription_plans: {
    include: {
      subscription_plan_features: { orderBy: { sort_order: "asc" as const } },
    },
  },
  barbers: { select: { id: true, display_name: true, photo_url: true } },
  subscription_cycles: {
    orderBy: { period_start: "desc" as const },
    take: 1,
    include: { subscription_usages: true },
  },
} as const;

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function buildSaoPauloMonthStart(year: number, month: number) {
  const adjustedYear = year + Math.floor((month - 1) / 12);
  const adjustedMonth = ((month - 1) % 12 + 12) % 12 + 1;
  return new Date(
    `${adjustedYear}-${String(adjustedMonth).padStart(2, "0")}-01T00:00:00-03:00`
  );
}

function getNextMonthStart(date = new Date()) {
  const parts = getSaoPauloDateParts(date);
  return buildSaoPauloMonthStart(parts.year, parts.month + 1);
}

/* ───── LIST ───── */
export async function listSubscriptionsInBarbershop(params: {
  barbershopId: string;
  userId?: string;
  status?: string;
  search?: string;
  searchType?: "name" | "cpf";
  page?: number;
  limit?: number;
}) {
  const where: any = { barbershop_id: params.barbershopId };

  if (params.userId) where.user_id = params.userId;
  if (params.status) where.status = params.status;

  if (params.search) {
    const term = params.search.trim();
    if (params.searchType === "cpf") {
      where.users = { cpf: { contains: term } };
    } else {
      where.users = { name: { contains: term, mode: "insensitive" } };
    }
  }

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  // const [items, total] = await Promise.all([
  //   prisma.subscriptions.findMany({
  //     where,
  //     orderBy: { created_at: "desc" },
  //     skip: (page - 1) * limit,
  //     take: limit,
  //     include: SUB_INCLUDE,
  //   }),
  //   prisma.subscriptions.count({ where }),
  // ]);

  const [items, total] = await prisma.$transaction([
    prisma.subscriptions.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: SUB_INCLUDE,
    }),
    prisma.subscriptions.count({ where }),
  ]);

  return { items, total };
}

/* ───── GET BY ID ───── */
export async function findSubscriptionByIdInBarbershop(
  barbershopId: string,
  id: string
) {
  return prisma.subscriptions.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: SUB_INCLUDE,
  });
}

/* ───── FIND ACTIVE/PENDING BY USER ───── */
export async function findActiveSubscriptionByUser(
  barbershopId: string,
  userId: string
) {
  const startOfToday = getStartOfToday();

  return prisma.subscriptions.findFirst({
    where: {
      barbershop_id: barbershopId,
      user_id: userId,
      status: "active",
      OR: [
        { next_billing_at: null },
        { next_billing_at: { gte: startOfToday } },
      ],
    },
    orderBy: [
      { last_billing_at: "desc" },
      { created_at: "desc" },
    ],
    include: SUB_INCLUDE,
  });
}

/* ───── CREATE (subscription + first cycle) ───── */
export async function createSubscriptionTx(data: {
  barbershopId: string;
  userId: string;
  planId: string;
  amount: number;
  paymentMethod?: string;
  isRecurring?: boolean;
  autoRenewal?: boolean;
  cutsPerMonth: number;
}) {
  return prisma.$transaction(async (tx: any) => {
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const sub = await tx.subscriptions.create({
      data: {
        barbershop_id: data.barbershopId,
        user_id: data.userId,
        plan_id: data.planId,
        amount: data.amount,
        payment_method: data.paymentMethod as any,
        is_recurring: data.isRecurring ?? true,
        auto_renewal: data.autoRenewal ?? true,
        status: "active",
        started_at: now,
        next_billing_at: nextBilling,
        last_billing_at: now,
        days_overdue: 0,
        overdue_notification_sent: false,
      },
    });

    const periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const periodEnd = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);

    await tx.subscription_cycles.create({
      data: {
        subscription_id: sub.id,
        period_start: periodStart,
        period_end: periodEnd,
        cuts_included: data.cutsPerMonth,
        cuts_used: 0,
      },
    });

    return tx.subscriptions.findUnique({
      where: { id: sub.id },
      include: SUB_INCLUDE,
    });
  });
}

/* ───── UPDATE ───── */
export async function updateSubscriptionInBarbershop(
  barbershopId: string,
  id: string,
  data: Record<string, any>
) {
  const existing = await prisma.subscriptions.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  data.updated_at = new Date();

  return prisma.subscriptions.update({
    where: { id },
    data,
    include: SUB_INCLUDE,
  });
}

export async function changeSubscriptionPlanInBarbershop(
  barbershopId: string,
  id: string,
  data: {
    planId: string;
    amount: number;
    paymentMethod?: string | null;
    cutsPerMonth: number;
  }
) {
  const existing = await prisma.subscriptions.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: {
      subscription_cycles: {
        orderBy: { period_start: "desc" },
        take: 1,
      },
    },
  });
  if (!existing) return null;

  if (existing.pagarme_subscription_id) {
    throw badRequest("Assinaturas com recorrencia no Pagar.me devem ser alteradas pelo checkout/cobranca externa.");
  }

  return prisma.$transaction(async (tx: any) => {
    await tx.subscriptions.update({
      where: { id },
      data: {
        plan_id: data.planId,
        amount: data.amount,
        payment_method: data.paymentMethod as any,
        updated_at: new Date(),
      },
    });

    const currentCycle = existing.subscription_cycles?.[0];
    if (currentCycle) {
      await tx.subscription_cycles.update({
        where: { id: currentCycle.id },
        data: {
          cuts_included: data.cutsPerMonth,
        },
      });
    }

    return tx.subscriptions.findUnique({
      where: { id },
      include: SUB_INCLUDE,
    });
  });
}

/* ───── CANCEL ───── */
export async function cancelSubscriptionInBarbershop(
  barbershopId: string,
  id: string
) {
  const existing = await prisma.subscriptions.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  return prisma.subscriptions.update({
    where: { id },
    data: {
      status: "cancelled",
      ended_at: new Date(),
      updated_at: new Date(),
    },
    include: SUB_INCLUDE,
  });
}

/* ───── RENEW (criar novo ciclo) ───── */
export async function renewSubscriptionTx(
  barbershopId: string,
  id: string,
  cutsPerMonth: number
) {
  const existing = await prisma.subscriptions.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: { subscription_plans: true },
  });
  if (!existing) return null;

  return prisma.$transaction(async (tx: any) => {
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const nextMonthStart = getNextMonthStart(now);

    const updated = await tx.subscriptions.updateMany({
      where: {
        id,
        barbershop_id: barbershopId,
        OR: [
          { next_billing_at: null },
          { next_billing_at: { lt: nextMonthStart } },
        ],
      },
      data: {
        status: "active",
        last_billing_at: now,
        next_billing_at: nextBilling,
        days_overdue: 0,
        overdue_notification_sent: false,
        ended_at: null,
        updated_at: now,
      },
    });

    if (updated.count === 0) {
      throw badRequest("Este ciclo ja foi renovado para o mes seguinte.");
    }

    const periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const periodEnd = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);

    await tx.subscription_cycles.create({
      data: {
        subscription_id: id,
        period_start: periodStart,
        period_end: periodEnd,
        cuts_included: cutsPerMonth,
        cuts_used: 0,
      },
    });

    return tx.subscriptions.findUnique({
      where: { id },
      include: SUB_INCLUDE,
    });
  });
}

/* ───── FIND OVERDUE SUBSCRIPTIONS ───── */
export async function findOverdueSubscriptions(barbershopId: string) {
  const now = new Date();

  return prisma.subscriptions.findMany({
    where: {
      barbershop_id: barbershopId,
      status: { in: ["active", "paused"] },
      next_billing_at: { lt: now },
    },
    include: SUB_INCLUDE,
  });
}

/* ───── APPLY OVERDUE STATES ───── */
export async function applyOverdueStates(
  updates: Array<{ id: string; status: "paused" | "cancelled"; daysOverdue: number }>
) {
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((update) =>
      prisma.subscriptions.update({
        where: { id: update.id },
        data: {
          status: update.status,
          days_overdue: update.daysOverdue,
          ended_at: update.status === "cancelled" ? new Date() : null,
          updated_at: new Date(),
        },
      })
    )
  );
}

/* ───── FIND ACTIVE BY BARBERSHOP (any owner) ───── */
export async function findActiveSubscriptionByBarbershop(barbershopId: string) {
  const startOfToday = getStartOfToday();

  return prisma.subscriptions.findFirst({
    where: {
      barbershop_id: barbershopId,
      status: "active",
      OR: [
        { next_billing_at: null },
        { next_billing_at: { gte: startOfToday } },
      ],
    },
    orderBy: [
      { last_billing_at: "desc" },
      { created_at: "desc" },
    ],
    include: SUB_INCLUDE,
  });
}
