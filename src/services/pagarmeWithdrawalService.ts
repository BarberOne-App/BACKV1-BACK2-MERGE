import { badRequest, notFound } from "../errors/index.js";
import prisma from "../database/database.js";
import { pagarmeRequest } from "./pagarmeApi.js";

function centsToCurrency(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return amount / 100;
}

function currencyToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw badRequest("Informe um valor de saque maior que zero.");
  }

  return Math.round(amount * 100);
}

function normalizeBalance(data: any) {
  const available = data?.available_amount ?? data?.available ?? data?.available_balance ?? 0;
  const waitingFunds = data?.waiting_funds_amount ?? data?.waiting_funds ?? data?.pending_amount ?? 0;
  const transferred = data?.transferred_amount ?? data?.transferred ?? 0;

  return {
    availableAmount: centsToCurrency(available),
    waitingFundsAmount: centsToCurrency(waitingFunds),
    transferredAmount: centsToCurrency(transferred),
    raw: data,
  };
}

async function getRecipientId(barbershopId: string) {
  const barbershop = await prisma.barbershops.findUnique({
    where: { id: barbershopId },
    select: {
      pagarme_recipient_id: true,
      pagarme_recipient_status: true,
    },
  });

  if (!barbershop) throw notFound("Barbearia nao encontrada.");

  const recipientId = String(barbershop.pagarme_recipient_id || "").trim();
  if (!recipientId) {
    throw badRequest("Cadastre o recebedor Pagar.me da barbearia antes de solicitar saque.");
  }

  return {
    recipientId,
    status: barbershop.pagarme_recipient_status ?? null,
  };
}

export async function getPagarmeWithdrawalBalanceService(barbershopId: string) {
  const recipient = await getRecipientId(barbershopId);
  const balance = await pagarmeRequest(
    `/recipients/${encodeURIComponent(recipient.recipientId)}/balance`,
    { method: "GET" },
  );

  return {
    recipientId: recipient.recipientId,
    recipientStatus: recipient.status,
    balance: normalizeBalance(balance),
  };
}

export async function requestPagarmeWithdrawalService(params: {
  barbershopId: string;
  amount: number;
}) {
  const recipient = await getRecipientId(params.barbershopId);
  const amountInCents = currencyToCents(params.amount);

  const balanceResult = await getPagarmeWithdrawalBalanceService(params.barbershopId);
  const availableInCents = Math.round(balanceResult.balance.availableAmount * 100);

  if (amountInCents > availableInCents) {
    throw badRequest("O valor solicitado e maior que o saldo disponivel para saque.");
  }

  const withdrawal = await pagarmeRequest(
    `/recipients/${encodeURIComponent(recipient.recipientId)}/withdrawals`,
    {
      method: "POST",
      body: JSON.stringify({ amount: amountInCents }),
    },
  );

  return {
    recipientId: recipient.recipientId,
    requestedAmount: params.amount,
    requestedAmountCents: amountInCents,
    withdrawal,
  };
}
