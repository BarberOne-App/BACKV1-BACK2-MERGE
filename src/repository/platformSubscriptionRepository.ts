// repository/platformSubscriptionRepository.ts

import prisma from "../database/database.js";

export async function findBarbershopForReactivation(barbershopId: string) {
  return prisma.barbershops.findUnique({
    where: {
      id: barbershopId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      cnpj: true,
      status: true,
      created_at: true,
      platform_subscription_status: true,
    },
  });
}

export async function findPlatformPlanById(platformPlanId: string) {
  return prisma.platform_plans.findUnique({
    where: {
      id: platformPlanId,
    },
  });
}

export async function updateBarbershopAfterPlatformSubscription(params: {
  barbershopId: string;
  platformPlanId: string;
  pagarmeSubscriptionId: string;
  subscriptionStatus: string;
  nextBillingDate?: Date | null;
}) {
  return prisma.barbershops.update({
    where: {
      id: params.barbershopId,
    },
    data: {
      status: "active",
      platform_plan_id: params.platformPlanId,
      platform_subscription_id: params.pagarmeSubscriptionId,
      platform_subscription_status: params.subscriptionStatus,
      next_billing_date: params.nextBillingDate ?? null,
      trial_ends_at: null,
      updated_at: new Date(),
    } as any,
  });
}

export async function createBarbershopPlatformSubscriptionRecord(params: {
  barbershopId: string;
  platformPlanId: string;
  pagarmeSubscriptionId: string;
  amount: number;
  status: string;
  nextBillingDate?: Date | null;
}) {
  return prisma.platform_subscriptions.create({
    data: {
      barbershop_id: params.barbershopId,
      platform_plan_id: params.platformPlanId,
      pagarme_subscription_id: params.pagarmeSubscriptionId,
      amount: params.amount,
      status: params.status,
      start_date: new Date(),
      next_billing_date: params.nextBillingDate ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    } as any,
  });
}