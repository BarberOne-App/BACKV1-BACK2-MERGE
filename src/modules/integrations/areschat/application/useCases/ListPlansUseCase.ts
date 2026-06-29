import { listPlansForIntegration } from "../../infra/repositories/IntegrationPlanRepository.js";
import { mapPlanToIntegrationDto } from "../mappers/IntegrationPlanMapper.js";

export interface ListPlansInput {
  tenantId: string;
}

export async function ListPlansUseCase({ tenantId }: ListPlansInput) {
  const plans = await listPlansForIntegration({ tenantId });
  return plans.map(mapPlanToIntegrationDto);
}
