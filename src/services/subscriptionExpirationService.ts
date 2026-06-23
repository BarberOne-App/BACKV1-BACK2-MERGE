import prisma from "../database/database.js";

const CLIENT_ACTIVE_STATUSES = ["active", "paused"] as const;
const PLATFORM_ACTIVE_STATUSES = ["active", "future", "trialing", "pending"] as const;

export function getStartOfToday(referenceDate = new Date()): Date {
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday;
}

export async function expireClientSubscriptions(params: {
  barbershopId: string;
  userId?: string;
}) {
  const now = new Date();

  return prisma.subscriptions.updateMany({
    where: {
      barbershop_id: params.barbershopId,
      ...(params.userId ? { user_id: params.userId } : {}),
      status: { in: [...CLIENT_ACTIVE_STATUSES] },
      next_billing_at: { lt: getStartOfToday(now) },
    },
    data: {
      status: "expired",
      ended_at: now,
      updated_at: now,
    },
  });
}

export async function expirePlatformSubscription(barbershopId: string) {
  const now = new Date();

  const subscription = await prisma.barbershop_platform_subscriptions.findUnique({
    where: { barbershop_id: barbershopId },
    select: { id: true, status: true, next_billing_date: true, canceled_at: true },
  });

  if (
    !subscription?.next_billing_date ||
    subscription.canceled_at !== null ||
    !PLATFORM_ACTIVE_STATUSES.includes(subscription.status as (typeof PLATFORM_ACTIVE_STATUSES)[number]) ||
    subscription.next_billing_date > now
  ) {
    return false;
  }

  await prisma.$transaction([
    prisma.barbershop_platform_subscriptions.update({
      where: { id: subscription.id },
      data: { status: "expired", updated_at: now },
    }),
    prisma.barbershops.update({
      where: { id: barbershopId },
      data: {
        platform_subscription_status: "expired",
        status: "blocked",
        blocked_reason: "Assinatura da plataforma expirada",
        blocked_at: now,
        updated_at: now,
      },
    }),
  ]);

  return true;
}
