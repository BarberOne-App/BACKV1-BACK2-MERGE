import { listPaymentMethodsForIntegration } from "../../infra/repositories/IntegrationPaymentMethodRepository.js";
import { mapPaymentMethodToIntegrationDto } from "../mappers/IntegrationPaymentMethodMapper.js";

export interface ListPaymentMethodsInput {
  tenantId: string;
}

export async function ListPaymentMethodsUseCase({
  tenantId
}: ListPaymentMethodsInput) {
  const methods = await listPaymentMethodsForIntegration({ tenantId });
  return methods.map(mapPaymentMethodToIntegrationDto);
}
