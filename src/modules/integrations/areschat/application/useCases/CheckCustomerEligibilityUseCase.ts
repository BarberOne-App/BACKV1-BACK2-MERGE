import { mapEligibleCustomer, mapIneligibleCustomer } from "../mappers/EligibilityResponseMapper.js";
import { findActiveSubscriptionByUser } from "../../../../../repository/subscriptionRepository.js";
import {
  findUserByCpfInBarbershop,
  findUserByEmailInBarbershop,
  findUserByPhoneInBarbershop
} from "../../infra/repositories/IntegrationCustomerRepository.js";

export interface CheckCustomerEligibilityInput {
  tenantId: string;
  identifierType: "phone" | "email" | "document";
  identifierValue: string;
}

const normalizePhone = (value: string): string => value.replace(/\D/g, "");
const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeDocument = (value: string): string => value.replace(/\D/g, "");

export async function CheckCustomerEligibilityUseCase({
  tenantId,
  identifierType,
  identifierValue
}: CheckCustomerEligibilityInput) {
  let customer = null;

  if (identifierType === "phone") {
    customer = await findUserByPhoneInBarbershop(
      tenantId,
      normalizePhone(identifierValue)
    );
  }

  if (identifierType === "email") {
    customer = await findUserByEmailInBarbershop(
      tenantId,
      normalizeEmail(identifierValue)
    );
  }

  if (identifierType === "document") {
    customer = await findUserByCpfInBarbershop(
      tenantId,
      normalizeDocument(identifierValue)
    );
  }

  if (!customer) {
    return mapIneligibleCustomer(
      "CUSTOMER_NOT_FOUND",
      "Cliente nao encontrado"
    );
  }

  const activeSubscription = await findActiveSubscriptionByUser(
    tenantId,
    customer.id
  );

  if (!activeSubscription) {
    return mapIneligibleCustomer(
      "NO_ACTIVE_PLAN",
      "Cliente sem plano ativo",
      customer
    );
  }

  return mapEligibleCustomer(customer, {
    id: activeSubscription.subscription_plans?.id || activeSubscription.plan_id,
    name: activeSubscription.subscription_plans?.name || "Plano ativo",
    status: activeSubscription.status
  });
}
