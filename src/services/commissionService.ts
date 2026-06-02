type CommissionType = "subscription" | "single" | "chemistry";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolveServiceCommissionType(service: {
  coveredByPlan?: boolean | null;
  commissionPercent?: number | null;
  serviceName?: string | null;
}): CommissionType {
  if (service.coveredByPlan === true) {
    return "subscription";
  }

  const normalizedServiceName = normalizeText(service.serviceName);

  if (
    normalizedServiceName.includes("quimic") ||
    normalizedServiceName.includes("quimica")
  ) {
    return "chemistry";
  }

  return "single";
}

export function calculateCommission(params: {
  amount: number;
  type: CommissionType;
  commissionPercent?: number | null;
}) {
  const amount = Number(params.amount) || 0;
  const parsed = Number(params.commissionPercent);
  const hasConfiguredPercent =
    params.commissionPercent !== null &&
    params.commissionPercent !== undefined &&
    Number.isFinite(parsed) &&
    parsed > 0;
  const commissionPercent = hasConfiguredPercent ? parsed : NaN;

  const effectivePercent = Number.isFinite(commissionPercent)
    ? commissionPercent
    : getCommissionPercentByType(params.type);

  return roundMoney((amount * effectivePercent) / 100);
}

export function getCommissionPercentByType(type: CommissionType) {
  switch (type) {
    case "subscription":
      return 50;

    case "chemistry":
      return 40;

    case "single":
    default:
      return 50;
  }
}

export type { CommissionType };
