import { badRequest, conflict, forbidden, notFound } from "../errors/index.js";
import {
  applyOverdueStates,
  cancelSubscriptionInBarbershop,
  createSubscriptionTx,
  findActiveSubscriptionByUser,
  findOverdueSubscriptions,
  findSubscriptionByIdInBarbershop,
  listSubscriptionsInBarbershop,
  renewSubscriptionTx,
  updateSubscriptionInBarbershop,
} from "../repository/subscriptionRepository.js";
import { findPlanByIdInBarbershop } from "../repository/subscriptionPlanRepository.js";
import { findBarberByIdInBarbershop } from "../repository/barberRepository.js";

/* ────────── helpers ────────── */

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeFeatureText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  if (text.includes("::")) {
    const parts = text.split("::");
    const label = parts[parts.length - 1].trim();
    return label.length > 0 ? label : null;
  }
  if (UUID_RE.test(text)) return null;
  return text;
}

function serialize(sub: any) {
  const plan = sub.subscription_plans;
  const cycle = sub.subscription_cycles?.[0] ?? null;

  return {
    id: sub.id,
    barbershopId: sub.barbershop_id,
    userId: sub.user_id,
    user: sub.users
      ? { id: sub.users.id, name: sub.users.name, email: sub.users.email, phone: sub.users.phone, cpf: sub.users.cpf ?? null }
      : null,
    planId: sub.plan_id,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          subtitle: plan.subtitle,
          price: decimalToNumber(plan.price),
          cutsPerMonth: plan.cuts_per_month,
          color: plan.color,
          recommended: plan.recommended,
          features: (plan.subscription_plan_features ?? [])
              .map((f: any) => normalizeFeatureText(f.feature))
              .filter((f: string | null): f is string => f !== null),
        }
      : null,
    amount: decimalToNumber(sub.amount),
    status: sub.status,
    startedAt: sub.started_at,
    nextBillingAt: sub.next_billing_at,
    lastBillingAt: sub.last_billing_at,
    endedAt: sub.ended_at,
    paymentMethod: sub.payment_method,
    isRecurring: sub.is_recurring,
    autoRenewal: sub.auto_renewal,
    daysOverdue: sub.days_overdue,
    overdueNotificationSent: sub.overdue_notification_sent,
    monthlyBarberId: sub.monthly_barber_id,
    monthlyBarber: sub.monthly_barber
      ? { id: sub.monthly_barber.id, displayName: sub.monthly_barber.display_name, photoUrl: sub.monthly_barber.photo_url }
      : null,
    monthlyBarberSetAt: sub.monthly_barber_set_at,
    currentCycle: cycle
      ? {
          id: cycle.id,
          periodStart: cycle.period_start,
          periodEnd: cycle.period_end,
          cutsIncluded: cycle.cuts_included,
          cutsUsed: cycle.cuts_used,
          cutsRemaining: cycle.cuts_included - cycle.cuts_used,
        }
      : null,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
  };
}

function toStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getOverdueDays(nextBillingAt: Date, now: Date): number {
  const startToday = toStartOfDay(now).getTime();
  const startBillingDate = toStartOfDay(nextBillingAt).getTime();
  const msDiff = startToday - startBillingDate;
  const days = Math.floor(msDiff / (24 * 60 * 60 * 1000));
  return days > 0 ? days : 0;
}

/* ─────────── LIST ─────────── */
export async function listSubscriptionsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  query: {
    userId?: string;
    status?: string;
    search?: string;
    searchType?: "name" | "cpf";
    page?: number;
    limit?: number;
  };
}) {
  // Clientes só veem suas próprias assinaturas
  let userId = params.query.userId;
  if (params.actorRole === "client") {
    userId = params.actorId;
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const { items, total } = await listSubscriptionsInBarbershop({
    barbershopId: params.barbershopId,
    userId,
    status: params.query.status,
    search: params.query.search,
    searchType: params.query.searchType,
    page,
    limit,
  });

  return { page, limit, total, items: items.map(serialize) };
}

/* ─────────── GET BY ID ─────────── */
export async function getSubscriptionByIdService(params: {
  barbershopId: string;
  subscriptionId: string;
}) {
  const sub = await findSubscriptionByIdInBarbershop(params.barbershopId, params.subscriptionId);
  if (!sub) throw notFound("Assinatura não encontrada");
  return serialize(sub);
}

/* ─────────── CREATE ─────────── */
export async function createSubscriptionService(params: {
  barbershopId: string;
  actorId: string;
  actorRole: string;
  data: {
    userId?: string;
    planId: string;
    amount: number;
    paymentMethod?: string;
    isRecurring?: boolean;
    autoRenewal?: boolean;
  };
}) {
  // 1. Verificar se já existe assinatura ativa para o user
  const userId =
    params.actorRole === "client"
      ? params.actorId
      : params.data.userId ?? params.actorId;

  const existing = await findActiveSubscriptionByUser(params.barbershopId, userId);
  if (existing) {
    throw conflict("Usuário já possui uma assinatura ativa nesta barbearia");
  }

  // 2. Buscar plano para obter cutsPerMonth
  const plan = await findPlanByIdInBarbershop(params.barbershopId, params.data.planId);
  if (!plan) throw notFound("Plano não encontrado");

  // 3. Criar subscription + primeiro ciclo
  const created = await createSubscriptionTx({
    barbershopId: params.barbershopId,
    userId,
    planId: params.data.planId,
    amount: params.data.amount,
    paymentMethod: params.data.paymentMethod,
    isRecurring: params.data.isRecurring,
    autoRenewal: params.data.autoRenewal,
    cutsPerMonth: plan.cuts_per_month,
  });

  return serialize(created);
}

/* ─────────── UPDATE ─────────── */
export async function updateSubscriptionService(params: {
  barbershopId: string;
  subscriptionId: string;
  data: {
    status?: string;
    monthlyBarberId?: string | null;
    autoRenewal?: boolean;
    isRecurring?: boolean;
    paymentMethod?: string;
  };
}) {
  const updateData: any = {};

  if (params.data.status !== undefined) updateData.status = params.data.status;
  if (params.data.autoRenewal !== undefined) updateData.auto_renewal = params.data.autoRenewal;
  if (params.data.isRecurring !== undefined) updateData.is_recurring = params.data.isRecurring;
  if (params.data.paymentMethod !== undefined) updateData.payment_method = params.data.paymentMethod;

  // Barbeiro mensal
  if (params.data.monthlyBarberId !== undefined) {
    if (params.data.monthlyBarberId) {
      const barber = await findBarberByIdInBarbershop(params.barbershopId, params.data.monthlyBarberId);
      if (!barber) throw notFound("Barbeiro não encontrado");
      updateData.monthly_barber_id = params.data.monthlyBarberId;
      updateData.monthly_barber_set_at = new Date();
    } else {
      updateData.monthly_barber_id = null;
      updateData.monthly_barber_set_at = null;
    }
  }

  const updated = await updateSubscriptionInBarbershop(
    params.barbershopId,
    params.subscriptionId,
    updateData
  );
  if (!updated) throw notFound("Assinatura não encontrada");
  return serialize(updated);
}

/* ─────────── CANCEL ─────────── */
export async function cancelSubscriptionService(params: {
  barbershopId: string;
  subscriptionId: string;
}) {
  const cancelled = await cancelSubscriptionInBarbershop(params.barbershopId, params.subscriptionId);
  if (!cancelled) throw notFound("Assinatura não encontrada");
  return serialize(cancelled);
}

/* ─────────── RENEW ─────────── */
export async function renewSubscriptionService(params: {
  barbershopId: string;
  subscriptionId: string;
}) {
  // Buscar subscription para saber cutsPerMonth do plano
  const sub = await findSubscriptionByIdInBarbershop(params.barbershopId, params.subscriptionId);
  if (!sub) throw notFound("Assinatura não encontrada");

  const cutsPerMonth = sub.subscription_plans?.cuts_per_month ?? 0;

  const renewed = await renewSubscriptionTx(
    params.barbershopId,
    params.subscriptionId,
    cutsPerMonth
  );
  if (!renewed) throw notFound("Assinatura não encontrada");
  return serialize(renewed);
}

/* ─────────── TOGGLE RECURRING ─────────── */
export async function toggleRecurringService(params: {
  barbershopId: string;
  subscriptionId: string;
}) {
  const sub = await findSubscriptionByIdInBarbershop(params.barbershopId, params.subscriptionId);
  if (!sub) throw notFound("Assinatura não encontrada");

  const updated = await updateSubscriptionInBarbershop(
    params.barbershopId,
    params.subscriptionId,
    { is_recurring: !sub.is_recurring }
  );
  if (!updated) throw notFound("Assinatura não encontrada");
  return serialize(updated);
}

/* ─────────── CHECK OVERDUE (job) ─────────── */
export async function checkOverdueService(params: {
  barbershopId: string;
}) {
  const overdueList = await findOverdueSubscriptions(params.barbershopId);

  if (overdueList.length === 0) {
    return { processed: 0, message: "Nenhuma assinatura vencida encontrada" };
  }

  const now = new Date();
  const updates = overdueList
    .map((sub) => {
      const nextBillingAt = sub.next_billing_at;
      if (!nextBillingAt) return null;

      const daysOverdue = getOverdueDays(nextBillingAt, now);
      if (daysOverdue <= 0) return null;

      return {
        id: sub.id,
        daysOverdue,
        status: daysOverdue >= 5 ? ("cancelled" as const) : ("paused" as const),
      };
    })
    .filter((item): item is { id: string; daysOverdue: number; status: "paused" | "cancelled" } => Boolean(item));

  if (updates.length === 0) {
    return { processed: 0, message: "Nenhuma assinatura vencida encontrada" };
  }

  await applyOverdueStates(updates);

  const cancelledCount = updates.filter((u) => u.status === "cancelled").length;
  const pausedCount = updates.filter((u) => u.status === "paused").length;
  const ids = updates.map((u) => u.id);

  return {
    processed: ids.length,
    paused: pausedCount,
    cancelled: cancelledCount,
    message: `${pausedCount} assinatura(s) pendente(s)/inativa(s) e ${cancelledCount} cancelada(s)`,
    subscriptionIds: ids,
  };
}
