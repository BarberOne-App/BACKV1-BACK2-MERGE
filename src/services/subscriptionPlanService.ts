import { notFound } from "../errors/index.js";
import {
  createPlanInBarbershop,
  findPlanByIdInBarbershop,
  deletePlanFromBarbershop,
  listPlansInBarbershop,
  updatePlanInBarbershop,
} from "../repository/subscriptionPlanRepository.js";

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Features may be stored as "TYPE::uuid::Human name" — extract only the human name.
// Pure UUIDs (bad data) are discarded (return null).
function normalizeFeatureText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  // Compound format: TYPE::uuid::Label
  if (text.includes("::")) {
    const parts = text.split("::");
    const label = parts[parts.length - 1].trim();
    return label.length > 0 ? label : null;
  }
  // Plain UUID — discard
  if (UUID_RE.test(text)) return null;
  return text;
}

function serialize(plan: any) {
  return {
    id: plan.id,
    barbershopId: plan.barbershop_id,
    name: plan.name,
    subtitle: plan.subtitle,
    price: decimalToNumber(plan.price),
    color: plan.color,
    cutsPerMonth: plan.cuts_per_month,
    paymentMethod: plan.payment_method,
    maxBarbers: plan.max_barbers,
    maxReceptionists: plan.max_receptionists,
    maxAdmins: plan.max_admins,
    active: plan.active,
    recommended: plan.recommended,
    pagarmePlanId: plan.pagarme_plan_id,
    features: (plan.subscription_plan_features ?? [])
      .map((f: any) => normalizeFeatureText(f.feature))
      .filter((f: string | null): f is string => f !== null),
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

/* ───────── LIST ───────── */
export async function listPlansService(params: {
  barbershopId: string;
  activeOnly?: boolean;
}) {
  const items = await listPlansInBarbershop({
    barbershopId: params.barbershopId,
    activeOnly: params.activeOnly,
  });
  return items.map(serialize);
}

/* ───────── GET BY ID ───────── */
export async function getPlanByIdService(params: {
  barbershopId: string;
  planId: string;
}) {
  const plan = await findPlanByIdInBarbershop(params.barbershopId, params.planId);
  if (!plan) throw notFound("Plano não encontrado");
  return serialize(plan);
}

/* ───────── CREATE ───────── */
export async function createPlanService(params: {
  barbershopId: string;
  data: {
    name: string;
    subtitle?: string | null;
    price: number;
    color?: string | null;
    cutsPerMonth: number;
    paymentMethod: string;
    active?: boolean;
    recommended?: boolean;
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  };
}) {
  const created = await createPlanInBarbershop({
    barbershopId: params.barbershopId,
    ...params.data,
  });
  return serialize(created);
}

/* ───────── UPDATE ───────── */
export async function updatePlanService(params: {
  barbershopId: string;
  planId: string;
  data: {
    name?: string;
    subtitle?: string | null;
    price?: number;
    color?: string | null;
    cutsPerMonth?: number;
    paymentMethod?: string;
    active?: boolean;
    recommended?: boolean;
    features?: string[];
    maxBarbers?: number | null;
    maxReceptionists?: number | null;
    maxAdmins?: number | null;
  };
}) {
  const updated = await updatePlanInBarbershop(
    params.barbershopId,
    params.planId,
    params.data
  );
  if (!updated) throw notFound("Plano não encontrado");
  return serialize(updated);
}

/* ───────── DELETE ───────── */
export async function deletePlanService(params: {
  barbershopId: string;
  planId: string;
}) {
  const deleted = await deletePlanFromBarbershop(params.barbershopId, params.planId);
  if (!deleted) throw notFound("Plano não encontrado");
  return { message: "Plano removido com sucesso" };
}
