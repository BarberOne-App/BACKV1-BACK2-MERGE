import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  birth_date: true,
  role: true,
  is_admin: true,
  permissions: true,
  photo_url: true,
  salary: true,
  created_at: true,
  updated_at: true,
  password_hash: true,
  current_barbershop_id: true,
  _count: {
    select: {
      appointments: true,
    },
  },
  appointments: {
    select: {
      start_at: true,
      status: true,
    },
    orderBy: {
      start_at: "desc",
    },
    take: 1,
  },
  barbers: {
    select: {
      id: true,
      display_name: true,
      specialty: true,
      photo_url: true,
      commission_percent: true,
    },
  },
} satisfies Prisma.usersSelect;

/* ── LIST ── */
export async function listUsersInBarbershop(params: {
  barbershopId: string;
  role?: string;
  excludeRole?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.usersWhereInput = {
    current_barbershop_id: params.barbershopId,
  };

  if (params.role) {
    where.role = params.role as any;
  } else if (params.excludeRole) {
    where.role = { not: params.excludeRole as any };
  }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const skip = (params.page - 1) * params.limit;

  const [items, total] = await prisma.$transaction([
    prisma.users.findMany({
      where,
      select: userSelect,
      orderBy: { name: "asc" },
      take: params.limit,
      skip,
    }),
    prisma.users.count({ where }),
  ]);

  return { items, total };
}

/* ── GET BY ID ── */
export async function findUserByIdInBarbershop(barbershopId: string, userId: string) {
  return prisma.users.findFirst({
    where: { id: userId, current_barbershop_id: barbershopId },
    select: userSelect,
  });
}

/* ── CHECK EMAIL ── */
export async function emailExistsInBarbershop(barbershopId: string, email: string) {
  const user = await prisma.users.findFirst({
    where: {
      email,
      user_barbershops: {
        some: {
          barbershop_id: barbershopId,
        },
      },
    },
    select: { id: true },
  });
  return !!user;
}

/* ── CHECK CPF (global unique) ── */
export async function cpfExistsForOtherUser(cpf: string, excludeUserId: string) {
  const user = await prisma.users.findFirst({
    where: { cpf, id: { not: excludeUserId } },
    select: { id: true },
  });
  return !!user;
}

/* ── CREATE ── */
export async function createUserInBarbershop(data: {
  barbershopId: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  birthDate?: Date | string | null;
  role: string;
  isAdmin: boolean;
  passwordHash: string;
  permissions?: any;
  photoUrl?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        current_barbershop_id: data.barbershopId,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        cpf: data.cpf ?? null,
        birth_date: data.birthDate ? new Date(data.birthDate) : null,
        role: data.role as any,
        is_admin: data.isAdmin,
        password_hash: data.passwordHash,
        permissions: data.permissions ?? undefined,
        photo_url: data.photoUrl ?? null,
        user_barbershops: {
          create: { barbershop_id: data.barbershopId },
        },
      },
      select: userSelect,
    });

    if (data.role === "barber") {
      await tx.barbers.create({
        data: {
          user_id: user.id,
          display_name: data.name,
          barbershop_id: data.barbershopId,
          salary: Math.round(Number(user.salary ?? 0)),
        },
      });
    }

    return user;
  });
}

/* ── UPDATE ── */
export async function updateUserInBarbershop(
  barbershopId: string,
  userId: string,
  data: Prisma.usersUpdateInput
) {
  const existing = await findUserByIdInBarbershop(barbershopId, userId);
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const user = await tx.users.update({
      where: { id: userId },
      data,
      select: userSelect,
    });

    const oldRole = existing.role;
    const newRole = user.role;

    if (newRole === "barber" && oldRole !== "barber") {
      await tx.barbers.upsert({
        where: { user_id: userId },
        update: {
          display_name: user.name,
          barbershop_id: barbershopId,
          salary: Math.round(Number(user.salary ?? 0)),
        },
        create: {
          user_id: userId,
          display_name: user.name,
          barbershop_id: barbershopId,
          salary: Math.round(Number(user.salary ?? 0)),
        },
      });
    } else if (oldRole === "barber" && newRole !== "barber") {
      const barber = await tx.barbers.findUnique({
        where: { user_id: userId },
      });
      if (barber) {
        await tx.barber_services.deleteMany({
          where: { barber_id: barber.id },
        });
        await tx.barbers.delete({
          where: { id: barber.id },
        });
      }
    } else if (newRole === "barber") {
      await tx.barbers.upsert({
        where: { user_id: userId },
        update: {
          display_name: user.name,
          salary: Math.round(Number(user.salary ?? 0)),
        },
        create: {
          user_id: userId,
          display_name: user.name,
          barbershop_id: barbershopId,
          salary: Math.round(Number(user.salary ?? 0)),
        },
      });
    }

    return user;
  });
}

/* ── UPDATE PERMISSIONS ── */
export async function updateUserPermissions(
  barbershopId: string,
  userId: string,
  permissions: Record<string, boolean>
) {
  const existing = await findUserByIdInBarbershop(barbershopId, userId);
  if (!existing) return null;

  return prisma.users.update({
    where: { id: userId },
    data: { permissions },
    select: userSelect,
  });
}

/* ── DELETE ── */
export async function deleteUserFromBarbershop(barbershopId: string, userId: string) {
  const existing = await findUserByIdInBarbershop(barbershopId, userId);
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const barber = await tx.barbers.findUnique({
      where: { user_id: userId },
    });

    if (barber) {
      await tx.barber_services.deleteMany({
        where: { barber_id: barber.id },
      });
      await tx.barbers.delete({
        where: { id: barber.id },
      });
    }

    await tx.users.delete({ where: { id: userId } });
    return true;
  });
}

/* ── GLOBAL GET / UPDATE HELPERS (for Super Admin) ── */
export async function findUserById(userId: string) {
  return prisma.users.findUnique({
    where: { id: userId },
    select: userSelect,
  });
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  const existing = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) return null;

  return prisma.users.update({
    where: { id: userId },
    data: { password_hash: passwordHash, updated_at: new Date() },
    select: userSelect,
  });
}
