import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

const barberSelect = {
  id: true,
  display_name: true,
  specialty: true,
  photo_url: true,
  commission_percent: true,
  user_id: true,
  salary: true,
  barbershop_id: true,
  created_at: true,
  updated_at: true,
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      is_admin: true,
    },
  },
  barber_services: {
    select: {
      service_id: true,
    },
  },
} satisfies Prisma.barbersSelect;

/* ── LIST ── */
export async function listBarbersInBarbershop(params: {
  barbershopId: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.barbersWhereInput = {
    barbershop_id: params.barbershopId,
  };

  if (params.q) {
    where.OR = [
      { display_name: { contains: params.q, mode: "insensitive" } },
      { specialty: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const skip = (params.page - 1) * params.limit;

  const [items, total] = await Promise.all([
    prisma.barbers.findMany({
      where,
      select: barberSelect,
      orderBy: { display_name: "asc" },
      take: params.limit,
      skip,
    }),
    prisma.barbers.count({ where }),
  ]);

  return { items, total };
}

/* ── GET BY ID ── */
export async function findBarberByIdInBarbershop(barbershopId: string, barberId: string) {
  return prisma.barbers.findFirst({
    where: { id: barberId, barbershop_id: barbershopId },
    select: barberSelect,
  });
}

export async function findBarberByUserIdInBarbershop(barbershopId: string, userId: string) {
  return prisma.barbers.findFirst({
    where: { user_id: userId, barbershop_id: barbershopId },
    select: barberSelect,
  });
}

/* ── CREATE (sem user vinculado) ── */
export async function createBarberInBarbershop(data: {
  barbershopId: string;
  displayName: string;
  specialty?: string | null;
  photoUrl?: string | null;
  salarioFixo?: number | null;
  commissionPercent?: number | null;
  userId?: string | null;
  serviceIds?: string[];
}) {
  return prisma.barbers.create({
    data: {
      barbershop_id: data.barbershopId,
      display_name: data.displayName,
      specialty: data.specialty ?? null,
      photo_url: data.photoUrl ?? null,
      salary: data.salarioFixo ?? 0,
      commission_percent: data.commissionPercent ?? null,
      user_id: data.userId ?? null,
      barber_services:
        data.serviceIds && data.serviceIds.length > 0
          ? {
              createMany: {
                data: data.serviceIds.map((serviceId) => ({ service_id: serviceId })),
                skipDuplicates: true,
              },
            }
          : undefined,
    },
    select: barberSelect,
  });
}

export async function replaceBarberServices(
  barbershopId: string,
  barberId: string,
  serviceIds: string[]
) {
  const existing = await findBarberByIdInBarbershop(barbershopId, barberId);
  if (!existing) return null;

  const uniqueServiceIds = [...new Set(serviceIds.map((id) => String(id)))];

  await prisma.$transaction(async (tx) => {
    await tx.barber_services.deleteMany({
      where: { barber_id: barberId },
    });

    if (uniqueServiceIds.length > 0) {
      await tx.barber_services.createMany({
        data: uniqueServiceIds.map((serviceId) => ({
          barber_id: barberId,
          service_id: serviceId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return findBarberByIdInBarbershop(barbershopId, barberId);
}

/* ── UPDATE ── */
export async function updateBarberInBarbershop(
  barbershopId: string,
  barberId: string,
  data: Prisma.barbersUpdateInput
) {
  const existing = await findBarberByIdInBarbershop(barbershopId, barberId);
  if (!existing) return null;

  return prisma.barbers.update({
    where: { id: barberId },
    data,
    select: barberSelect,
  });
}

/* ── LINK USER ── */
export async function linkBarberToUser(
  barbershopId: string,
  barberId: string,
  userId: string
) {
  const existing = await findBarberByIdInBarbershop(barbershopId, barberId);
  if (!existing) return null;

  return prisma.barbers.update({
    where: { id: barberId },
    data: { user_id: userId },
    select: barberSelect,
  });
}

/* ── DELETE ── */
export async function deleteBarberFromBarbershop(barbershopId: string, barberId: string) {
  const existing = await findBarberByIdInBarbershop(barbershopId, barberId);
  if (!existing) return null;

  await prisma.barbers.delete({ where: { id: barberId } });
  return true;
}
