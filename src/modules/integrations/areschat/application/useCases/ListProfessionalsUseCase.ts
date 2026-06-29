import { listProfessionalsForIntegration } from "../../infra/repositories/IntegrationProfessionalRepository.js";
import { mapProfessionalToIntegrationDto } from "../mappers/IntegrationProfessionalMapper.js";

export interface ListProfessionalsInput {
  tenantId: string;
  q?: string;
  serviceId?: string;
  customerId?: string;
}

export async function ListProfessionalsUseCase({
  tenantId,
  q,
  serviceId,
  customerId
}: ListProfessionalsInput) {
  const professionals = await listProfessionalsForIntegration({
    tenantId,
    q,
    serviceId,
    customerId
  });

  return professionals.map(mapProfessionalToIntegrationDto);
}
