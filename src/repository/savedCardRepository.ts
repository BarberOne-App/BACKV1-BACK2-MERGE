import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listSavedCards(params: {
  barbershopId: string;
  userId?: string;
}) {
  const where: any = { barbershop_id: params.barbershopId };
  if (params.userId) where.user_id = params.userId;

  return prisma.saved_cards.findMany({
    where,
    orderBy: { created_at: "desc" },
  });
}

/* ───── FIND BY ID ───── */
export async function findSavedCardById(barbershopId: string, id: string) {
  return prisma.saved_cards.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
}

/* ───── CREATE ───── */
export async function createSavedCard(data: {
  userId: string;
  lastDigits: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  brand: string;
  barbershopId: string;
}) {
  return prisma.saved_cards.create({
    data: {
      user_id: data.userId,
      last_digits: data.lastDigits,
      holder_name: data.holderName,
      expiry_month: data.expiryMonth,
      expiry_year: data.expiryYear,
      brand: data.brand,
      barbershop_id: data.barbershopId,
    },
  });
}

/* ───── UPDATE (set main) ───── */
export async function updateSavedCard(
  barbershopId: string,
  id: string,
  data: { is_main?: boolean }
) {
  return prisma.saved_cards.updateMany({
    where: { id, barbershop_id: barbershopId },
    data,
  });
}

/* ───── CLEAR MAIN FOR USER ───── */
export async function clearMainCards(barbershopId: string, userId: string) {
  return prisma.saved_cards.updateMany({
    where: { barbershop_id: barbershopId, user_id: userId, is_main: true },
    data: { is_main: false },
  });
}

/* ───── DELETE ───── */
export async function deleteSavedCard(barbershopId: string, id: string) {
  return prisma.saved_cards.deleteMany({
    where: { id, barbershop_id: barbershopId },
  });
}
