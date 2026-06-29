import { listServicesForIntegration } from "../../infra/repositories/IntegrationServiceRepository.js";
import { mapServiceToIntegrationDto } from "../mappers/IntegrationServiceMapper.js";

export interface ListServicesInput {
  tenantId: string;
  q?: string;
}

export async function ListServicesUseCase({ tenantId, q }: ListServicesInput) {
  const services = await listServicesForIntegration({ tenantId, q });
  return services.map(mapServiceToIntegrationDto);
}
