import { listPlansInBarbershop } from "../../../../../repository/subscriptionPlanRepository.js";

export async function listPlansForIntegration(params: { tenantId: string }) {
  return listPlansInBarbershop({
    barbershopId: params.tenantId,
    activeOnly: true
  });
}
