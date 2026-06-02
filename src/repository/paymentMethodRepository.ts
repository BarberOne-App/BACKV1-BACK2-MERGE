import prisma from "../database/database.js";

const PM_SELECT = {
  id: true,
  user_id: true,
  provider: true,
  type: true,
  token: true,
  brand: true,
  last4: true,
  exp_month: true,
  exp_year: true,
  holder_name: true,
  is_default: true,
  barbershop_id: true,
  created_at: true,
} as const;

/* ───── LIST ───── */
export async function listPaymentMethodsForUser(
  barbershopId: string,
  userId: string
) {
  return prisma.user_payment_methods.findMany({
    where: { barbershop_id: barbershopId, user_id: userId },
    orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
    select: PM_SELECT,
  });
}

/* ───── GET BY ID ───── */
export async function findPaymentMethodById(
  barbershopId: string,
  id: string
) {
  return prisma.user_payment_methods.findFirst({
    where: { id, barbershop_id: barbershopId },
    select: PM_SELECT,
  });
}

/* ───── CREATE ───── */
export async function createPaymentMethod(data: {
  barbershopId: string;
  userId: string;
  type: string;
  token: string;
  provider?: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  holderName?: string;
  isDefault?: boolean;
}) {
  // Se isDefault, remover default dos outros
  if (data.isDefault) {
    await prisma.user_payment_methods.updateMany({
      where: { barbershop_id: data.barbershopId, user_id: data.userId, is_default: true },
      data: { is_default: false },
    });
  }

  return prisma.user_payment_methods.create({
    data: {
      barbershop_id: data.barbershopId,
      user_id: data.userId,
      type: data.type,
      token: data.token,
      provider: data.provider ?? null,
      brand: data.brand ?? null,
      last4: data.last4 ?? null,
      exp_month: data.expMonth ?? null,
      exp_year: data.expYear ?? null,
      holder_name: data.holderName ?? null,
      is_default: data.isDefault ?? false,
    },
    select: PM_SELECT,
  });
}

/* ───── SET DEFAULT ───── */
export async function setPaymentMethodDefault(
  barbershopId: string,
  id: string,
  userId: string
) {
  const existing = await prisma.user_payment_methods.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  // Remover default dos outros
  await prisma.user_payment_methods.updateMany({
    where: { barbershop_id: barbershopId, user_id: userId, is_default: true },
    data: { is_default: false },
  });

  return prisma.user_payment_methods.update({
    where: { id },
    data: { is_default: true },
    select: PM_SELECT,
  });
}

/* ───── DELETE ───── */
export async function deletePaymentMethod(barbershopId: string, id: string) {
  const existing = await prisma.user_payment_methods.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
  if (!existing) return null;

  await prisma.user_payment_methods.delete({ where: { id } });
  return existing;
}
