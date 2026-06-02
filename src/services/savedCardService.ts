import { notFound } from "../errors/index.js";
import {
  clearMainCards,
  createSavedCard,
  deleteSavedCard,
  findSavedCardById,
  listSavedCards,
  updateSavedCard,
} from "../repository/savedCardRepository.js";

/* ─────────────── helpers ─────────────── */
function serialize(card: any) {
  return {
    id: card.id,
    userId: card.user_id,
    lastDigits: card.last_digits,
    holderName: card.holder_name,
    expiryMonth: card.expiry_month,
    expiryYear: card.expiry_year,
    brand: card.brand,
    isMain: card.is_main,
    createdAt: card.created_at,
  };
}

/* ───────── LIST ───────── */
export async function listSavedCardsService(params: {
  barbershopId: string;
  userId?: string;
}) {
  const items = await listSavedCards({
    barbershopId: params.barbershopId,
    userId: params.userId,
  });
  return items.map(serialize);
}

/* ───────── CREATE ───────── */
export async function createSavedCardService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    number: string;
    holderName: string;
    expiryMonth: string;
    expiryYear: string;
    brand?: string;
  };
}) {
  const lastDigits = params.data.number.slice(-4);

  const created = await createSavedCard({
    userId: params.actorId,
    lastDigits,
    holderName: params.data.holderName,
    expiryMonth: params.data.expiryMonth,
    expiryYear: params.data.expiryYear,
    brand: params.data.brand || "unknown",
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}

/* ───────── SET MAIN ───────── */
export async function setMainCardService(params: {
  barbershopId: string;
  actorId: string;
  cardId: string;
  isMain: boolean;
}) {
  const card = await findSavedCardById(params.barbershopId, params.cardId);
  if (!card) throw notFound("Cartão não encontrado");

  if (params.isMain) {
    // Desmarcar todos os outros como main
    await clearMainCards(params.barbershopId, card.user_id);
  }

  await updateSavedCard(params.barbershopId, params.cardId, {
    is_main: params.isMain,
  });

  return { message: params.isMain ? "Cartão definido como principal" : "Cartão desmarcado como principal" };
}

/* ───────── DELETE ───────── */
export async function deleteSavedCardService(params: {
  barbershopId: string;
  cardId: string;
}) {
  const card = await findSavedCardById(params.barbershopId, params.cardId);
  if (!card) throw notFound("Cartão não encontrado");

  await deleteSavedCard(params.barbershopId, params.cardId);
  return { message: "Cartão removido com sucesso" };
}
