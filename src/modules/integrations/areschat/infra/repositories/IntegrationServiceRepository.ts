import prisma from "../../../../../database/database.js";

export async function listServicesForIntegration(params: {
  tenantId: string;
  q?: string;
}) {
  return prisma.services.findMany({
    where: {
      barbershop_id: params.tenantId,
      active: true,
      ...(params.q
        ? {
            name: {
              contains: params.q,
              mode: "insensitive"
            }
          }
        : {})
    },
    orderBy: {
      name: "asc"
    }
  });
}
