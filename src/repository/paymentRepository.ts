import prisma from "../database/database.js";

const PAYMENT_INCLUDE = {
  users: { select: { id: true, name: true, email: true, phone: true } },
  appointments: {
    select: {
      id: true,
      start_at: true,
      end_at: true,
      status: true,
      barbers: { select: { id: true, display_name: true } },
      appointment_services: {
        select: {
          id: true,
          service_name: true,
          unit_price: true,
          quantity: true,
        },
      },
    },
  },
  subscriptions: {
    select: {
      id: true,
      status: true,
      subscription_plans: { select: { id: true, name: true } },
    },
  },
} as const;

/* ───── LIST (com filtros) ───── */
export async function listPaymentsInBarbershop(params: {
  barbershopId: string;
  userId?: string;
  appointmentId?: string;
  subscriptionId?: string;
  status?: string;
  method?: string;
  type?: "subscription" | "appointment" | "extra";
  page?: number;
  limit?: number;
}) {
  const where: any = { barbershop_id: params.barbershopId };

  if (params.userId) where.user_id = params.userId;
  if (params.appointmentId) where.appointment_id = params.appointmentId;
  if (params.subscriptionId) where.subscription_id = params.subscriptionId;
  if (params.status) where.status = params.status;
  if (params.method) where.method = params.method;

  if (params.type === "subscription") {
    where.subscription_id = { not: null };
  } else if (params.type === "appointment") {
    where.appointment_id = { not: null };
  } else if (params.type === "extra") {
    where.appointment_id = null;
    where.subscription_id = null;
  }

  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  // const [items, total] = await Promise.all([
  //   prisma.payment_transactions.findMany({
  //     where,
  //     orderBy: { created_at: "desc" },
  //     skip: (page - 1) * limit,
  //     take: limit,
  //     include: PAYMENT_INCLUDE,
  //   }),
  //   prisma.payment_transactions.count({ where }),
  // ]);

  const [items, total] = await prisma.$transaction([
    prisma.payment_transactions.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: PAYMENT_INCLUDE,
    }),
    prisma.payment_transactions.count({ where }),
  ]);

  return { items, total };
}

/* ───── GET BY ID ───── */
export async function findPaymentByIdInBarbershop(
  barbershopId: string,
  id: string
) {
  return prisma.payment_transactions.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: PAYMENT_INCLUDE,
  });
}

/* ───── CREATE or UPDATE (UPSERT for appointments) ───── */
export async function createPaymentInBarbershop(data: {
  barbershopId: string;
  userId?: string;
  appointmentId?: string;
  subscriptionId?: string;
  amount: number;
  method?: string;
  status?: string;
  statusRaw?: string;
  paidAt?: Date;
}) {
  // Para agendamentos, atualiza o registro existente quando houver.
  // Isso evita depender de alias de constraint no tipo gerado do Prisma Client.
  if (data.appointmentId) {
    const existing = await prisma.payment_transactions.findFirst({
      where: {
        barbershop_id: data.barbershopId,
        appointment_id: data.appointmentId,
      },
      orderBy: { created_at: "desc" },
      select: { id: true },
    });

    if (existing) {
      return prisma.payment_transactions.update({
        where: { id: existing.id },
        data: {
          user_id: data.userId ?? null,
          amount: data.amount,
          method: (data.method as any) ?? "local",
          status: (data.status as any) ?? "pending",
          status_raw: data.statusRaw ?? null,
          paid_at: data.paidAt ?? null,
          updated_at: new Date(),
        },
        include: PAYMENT_INCLUDE,
      });
    }

    return prisma.payment_transactions.create({
      data: {
        barbershop_id: data.barbershopId,
        user_id: data.userId ?? null,
        appointment_id: data.appointmentId,
        subscription_id: null,
        amount: data.amount,
        method: (data.method as any) ?? "local",
        status: (data.status as any) ?? "pending",
        status_raw: data.statusRaw ?? null,
        paid_at: data.paidAt ?? null,
      },
      include: PAYMENT_INCLUDE,
    });
  }

  // Para assinaturas, sempre cria novo registro (pode ter múltiplos)
  return prisma.payment_transactions.create({
    data: {
      barbershop_id: data.barbershopId,
      user_id: data.userId ?? null,
      appointment_id: null,
      subscription_id: data.subscriptionId ?? null,
      amount: data.amount,
      method: (data.method as any) ?? "local",
      status: (data.status as any) ?? "pending",
      status_raw: data.statusRaw ?? null,
      paid_at: data.paidAt ?? null,
    },
    include: PAYMENT_INCLUDE,
  });
}

/* ───── SYNC STATUS BY APPOINTMENT ───── */
export async function syncPaymentStatusByAppointment(
  barbershopId: string,
  appointmentId: string,
  status: string,
  paidAt?: Date | null,
) {
  const existing = await prisma.payment_transactions.findFirst({
    where: { barbershop_id: barbershopId, appointment_id: appointmentId },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.payment_transactions.update({
    where: { id: existing.id },
    data: {
      status: status as any,
      paid_at: paidAt ?? null,
      updated_at: new Date(),
    },
    include: PAYMENT_INCLUDE,
  });
}

/* ───── SUMMARY (aggregated totals) ───── */
export async function getPaymentSummary(barbershopId: string) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  // const [all, todayPaid] = await Promise.all([
  //   prisma.payment_transactions.groupBy({
  //     by: ['status'],
  //     where: { barbershop_id: barbershopId },
  //     _sum: { amount: true },
  //   }),
  //   prisma.payment_transactions.aggregate({
  //     where: {
  //       barbershop_id: barbershopId,
  //       status: { in: ['paid', 'approved'] },
  //       paid_at: { gte: todayStart, lt: todayEnd },
  //     },
  //     _sum: { amount: true },
  //   }),
  // ]);

  const [all, todayPaid] = await prisma.$transaction([
    prisma.payment_transactions.groupBy({
      by: ['status'],
      where: { barbershop_id: barbershopId },
      _sum: { amount: true },
      orderBy: {
        status: "asc",
      }
    }),
    prisma.payment_transactions.aggregate({
      where: {
        barbershop_id: barbershopId,
        status: { in: ['paid', 'approved'] },
        paid_at: { gte: todayStart, lt: todayEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const toNum = (v: any) => (v == null ? 0 : typeof v.toNumber === 'function' ? v.toNumber() : Number(v));

  const paid = all.filter((r) => r.status === 'paid' || r.status === 'approved')
    .reduce((sum, r) => sum + toNum(r._sum.amount), 0);
  const pending = all.filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + toNum(r._sum.amount), 0);
  const refunded = all.filter((r) => r.status === 'refunded')
    .reduce((sum, r) => sum + toNum(r._sum.amount), 0);
  const todayTotal = toNum(todayPaid._sum.amount);

  return { paid, pending, refunded, today: todayTotal };
}

/* ───── DELETE ───── */
export async function deletePaymentInBarbershop(barbershopId: string, id: string) {
  const existing = await prisma.payment_transactions.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;
  await prisma.payment_transactions.delete({ where: { id } });
  return true;
}

/* ───── UPDATE ───── */
export async function updatePaymentInBarbershop(
  barbershopId: string,
  id: string,
  data: Record<string, any>
) {
  const existing = await prisma.payment_transactions.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  data.updated_at = new Date();

  return prisma.payment_transactions.update({
    where: { id },
    data,
    include: PAYMENT_INCLUDE,
  });
}
