import prisma from "../../../../../database/database.js";

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  current_barbershop_id: true
} as const;

const normalizePhone = (value?: string | null) => String(value || "").replace(/\D/g, "");

export async function findUserByPhoneInBarbershop(
  tenantId: string,
  phone: string
) {
  const normalizedPhone = normalizePhone(phone);
  const candidates = await prisma.users.findMany({
    where: {
      phone: {
        not: null
      },
      user_barbershops: {
        some: {
          barbershop_id: tenantId
        }
      }
    },
    select: customerSelect
  });

  return candidates.find(customer => normalizePhone(customer.phone) === normalizedPhone) ?? null;
}

export async function findUserByEmailInBarbershop(
  tenantId: string,
  email: string
) {
  return prisma.users.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive"
      },
      user_barbershops: {
        some: {
          barbershop_id: tenantId
        }
      }
    },
    select: customerSelect
  });
}

export async function findUserByCpfInBarbershop(
  tenantId: string,
  cpf: string
) {
  return prisma.users.findFirst({
    where: {
      cpf,
      user_barbershops: {
        some: {
          barbershop_id: tenantId
        }
      }
    },
    select: customerSelect
  });
}

export async function findUserByIdInBarbershop(tenantId: string, userId: string) {
  return prisma.users.findFirst({
    where: {
      id: userId,
      user_barbershops: {
        some: {
          barbershop_id: tenantId
        }
      }
    },
    select: customerSelect
  });
}

export async function findUserByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const candidates = await prisma.users.findMany({
    where: {
      phone: {
        not: null
      }
    },
    select: customerSelect
  });

  return candidates.find(customer => normalizePhone(customer.phone) === normalizedPhone) ?? null;
}

export async function findUserByEmail(email: string) {
  return prisma.users.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive"
      }
    },
    select: customerSelect
  });
}

export async function findUserByCpf(cpf: string) {
  return prisma.users.findFirst({
    where: {
      cpf
    },
    select: customerSelect
  });
}

export async function linkUserToBarbershop(tenantId: string, userId: string) {
  const currentUser = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      current_barbershop_id: true
    }
  });

  return prisma.users.update({
    where: {
      id: userId
    },
    data: {
      current_barbershop_id: currentUser?.current_barbershop_id ?? tenantId,
      user_barbershops: {
        connectOrCreate: {
          where: {
            user_id_barbershop_id: {
              user_id: userId,
              barbershop_id: tenantId
            }
          },
          create: {
            barbershop_id: tenantId
          }
        }
      }
    },
    select: customerSelect
  });
}

export async function createCustomerInBarbershop(input: {
  tenantId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  passwordHash: string;
}) {
  return prisma.users.create({
    data: {
      current_barbershop_id: input.tenantId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      cpf: input.cpf ?? null,
      role: "client",
      is_admin: false,
      password_hash: input.passwordHash,
      user_barbershops: {
        create: {
          barbershop_id: input.tenantId
        }
      }
    },
    select: customerSelect
  });
}
