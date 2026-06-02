import { notFound } from "../errors/index.js";
import {
  createPaymentMethod,
  deletePaymentMethod,
  findPaymentMethodById,
  listPaymentMethodsForUser,
  setPaymentMethodDefault,
} from "../repository/paymentMethodRepository.js";

/* ── helpers ── */

function serialize(pm: any) {
  return {
    id: pm.id,
    userId: pm.user_id,
    barbershopId: pm.barbershop_id,
    type: pm.type,
    provider: pm.provider,
    brand: pm.brand,
    last4: pm.last4,
    expMonth: pm.exp_month,
    expYear: pm.exp_year,
    holderName: pm.holder_name,
    isDefault: pm.is_default,
    createdAt: pm.created_at,
  };
}

/* ───── LIST ───── */
export async function listPaymentMethodsService(params: {
  barbershopId: string;
  userId: string;
}) {
  const items = await listPaymentMethodsForUser(params.barbershopId, params.userId);
  return items.map(serialize);
}

/* ───── CREATE ───── */
export async function createPaymentMethodService(params: {
  barbershopId: string;
  data: {
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
  };
}) {
  const created = await createPaymentMethod({
    barbershopId: params.barbershopId,
    ...params.data,
  });
  return serialize(created);
}

/* ───── SET DEFAULT ───── */
export async function setDefaultPaymentMethodService(params: {
  barbershopId: string;
  paymentMethodId: string;
  userId: string;
}) {
  const updated = await setPaymentMethodDefault(
    params.barbershopId,
    params.paymentMethodId,
    params.userId
  );
  if (!updated) throw notFound("Método de pagamento não encontrado");
  return serialize(updated);
}

/* ───── DELETE ───── */
export async function deletePaymentMethodService(params: {
  barbershopId: string;
  paymentMethodId: string;
}) {
  const deleted = await deletePaymentMethod(params.barbershopId, params.paymentMethodId);
  if (!deleted) throw notFound("Método de pagamento não encontrado");
  return { message: "Método de pagamento removido com sucesso" };
}
