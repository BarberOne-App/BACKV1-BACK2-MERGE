import prisma from "../../../../../database/database.js";
import { findActiveSubscriptionByUser } from "../../../../../repository/subscriptionRepository.js";

export async function listProfessionalsForIntegration(params: {
  tenantId: string;
  q?: string;
  serviceId?: string;
  customerId?: string;
}) {
  if (params.serviceId && params.customerId) {
    const service = await prisma.services.findFirst({
      where: {
        id: params.serviceId,
        barbershop_id: params.tenantId
      },
      select: {
        id: true,
        name: true,
        covered_by_plan: true
      }
    });

    if (service?.covered_by_plan || /\bassina/i.test(service?.name || "")) {
      const activeSubscription = await findActiveSubscriptionByUser(
        params.tenantId,
        params.customerId
      );

      if (!activeSubscription?.monthly_barber_id) {
        return [];
      }

      return prisma.barbers.findMany({
        where: {
          id: activeSubscription.monthly_barber_id,
          barbershop_id: params.tenantId,
          barber_services: {
            some: {
              service_id: params.serviceId
            }
          }
        },
        select: {
          id: true,
          display_name: true,
          specialty: true,
          photo_url: true,
          barber_services: {
            select: {
              service_id: true
            }
          }
        },
        orderBy: {
          display_name: "asc"
        }
      });
    }
  }

  return prisma.barbers.findMany({
    where: {
      barbershop_id: params.tenantId,
      ...(params.q
        ? {
            OR: [
              {
                display_name: {
                  contains: params.q,
                  mode: "insensitive"
                }
              },
              {
                specialty: {
                  contains: params.q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(params.serviceId
        ? {
            barber_services: {
              some: {
                service_id: params.serviceId
              }
            }
          }
        : {})
    },
    select: {
      id: true,
      display_name: true,
      specialty: true,
      photo_url: true,
      barber_services: {
        select: {
          service_id: true
        }
      }
    },
    orderBy: {
      display_name: "asc"
    }
  });
}
