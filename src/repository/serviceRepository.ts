// src/repository/serviceRepository.ts
import prisma from "../database/database.js";

export async function createService(data: {
  barbershopId: string;
  name: string;
  base_price: number;
  duration_minutes: number;
  comission_percent?: number | null;
  image_url?: string | null;
  active?: boolean;
  promotional_price?: number;
  covered_by_plan?: boolean;
}) {
  return prisma.services.create({
    data: {
      barbershop_id: data.barbershopId,
      name: data.name,
      base_price: data.base_price,
      duration_minutes: data.duration_minutes,
      comission_percent: data.comission_percent ?? null,
      promotional_price: data.promotional_price ?? 0,
      covered_by_plan: data.covered_by_plan ?? false,
      image_url: data.image_url ?? null,
      active: data.active ?? true,
    },
  });
}

export async function findServiceById(barbershopId: string, id: string) {
  return prisma.services.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
}

export async function listServices(params: {
  barbershopId: string;
  q?: string;
  includeInactive?: boolean;
  page: number;
  limit: number;
}) {
  const where: any = {
    barbershop_id: params.barbershopId,
  };

  if (!params.includeInactive) where.active = true;

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const skip = (params.page - 1) * params.limit;

  const [items, total] = await Promise.all([
    prisma.services.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: params.limit,
      skip,
    }),
    prisma.services.count({ where }),
  ]);

  return { items, total };
}

export async function updateService(
  barbershopId: string,
  id: string,
  data: any
) {
  const existing = await findServiceById(barbershopId, id);
  if (!existing) return null;

  return prisma.services.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });
}

export async function softDeleteService(barbershopId: string, id: string) {
  const existing = await findServiceById(barbershopId, id);
  if (!existing) return null;

  const deactivated = await prisma.services.update({
    where: { id },
    data: {
      active: false,
      updated_at: new Date(),
    },
  });

  return {
    service: deactivated,
    deletedHard: false,
  };
}

export async function reactivateService(barbershopId: string, id: string) {
  const existing = await findServiceById(barbershopId, id);
  if (!existing) return null;

  const reactivated = await prisma.services.update({
    where: { id },
    data: {
      active: true,
      updated_at: new Date(),
    },
  });

  return reactivated;
}