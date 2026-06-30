import { Prisma } from "@prisma/client";
import prisma from "../database/database.js";
import { badRequest, notFound } from "../errors/index.js";

type PaymentRow = {
  id: string;
  user_id: string | null;
  client_name: string | null;
  appointment_id: string | null;
  subscription_id: string | null;
  amount: any;
  method: string;
  status: string;
  paid_at: Date | null;
  created_at: Date;
  appointment_start_at: Date | null;
  subscription_plan_name: string | null;
  status_raw: string | null;
};

type ClosingRow = {
  id: string;
  period_start: Date;
  period_end: Date;
  closed_at: Date;
  closed_by: string;
  closed_by_name: string | null;
  total_amount: any;
  payment_count: number;
  totals_by_method: any;
  payment_ids: any;
  note: string | null;
};

function toNumber(value: any) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toNumber === "function") return value.toNumber();
  return Number(value) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toDateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayRange(date?: string) {
  const day = date || toDateInput(new Date());
  return {
    start: new Date(`${day}T00:00:00-03:00`),
    end: new Date(`${day}T23:59:59.999-03:00`),
    date: day,
  };
}

function serializePayment(row: PaymentRow) {
  const statusRaw = String(row.status_raw || "");
  const cashOutMatch = statusRaw.match(/^cash_out:([^:]+):(.*)$/);
  const cashOutCategory = cashOutMatch?.[1] ?? null;
  const description = cashOutMatch ? cashOutMatch[2] || null : statusRaw || null;

  return {
    id: row.id,
    userId: row.user_id,
    clientName: row.client_name,
    appointmentId: row.appointment_id,
    subscriptionId: row.subscription_id,
    amount: roundMoney(toNumber(row.amount)),
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    appointmentStartAt: row.appointment_start_at,
    subscriptionPlanName: row.subscription_plan_name,
    description,
    cashOutCategory,
    type: cashOutCategory ? "cash_out" : row.appointment_id ? "appointment" : row.subscription_id ? "subscription" : "extra",
  };
}

function serializeClosing(row: ClosingRow) {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closedByName: row.closed_by_name,
    totalAmount: roundMoney(toNumber(row.total_amount)),
    paymentCount: Number(row.payment_count || 0),
    totalsByMethod: row.totals_by_method ?? {},
    paymentIds: row.payment_ids ?? [],
    note: row.note,
  };
}

async function getLastClosingEnd(barbershopId: string, start: Date, end: Date) {
  const rows = await prisma.$queryRaw<Array<{ period_end: Date }>>`
    SELECT period_end
    FROM cash_closings
    WHERE barbershop_id = ${barbershopId}::uuid
      AND period_end >= ${start}
      AND period_end <= ${end}
    ORDER BY period_end DESC
    LIMIT 1
  `;

  return rows[0]?.period_end ?? null;
}

async function resolvePeriod(params: {
  barbershopId: string;
  date?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const range = dayRange(params.date);
  const periodEnd = params.periodEnd ? new Date(params.periodEnd) : new Date();

  if (Number.isNaN(periodEnd.getTime())) {
    throw badRequest("Periodo final invalido.");
  }

  let periodStart = params.periodStart ? new Date(params.periodStart) : null;

  if (periodStart && Number.isNaN(periodStart.getTime())) {
    throw badRequest("Periodo inicial invalido.");
  }

  if (!periodStart) {
    periodStart = (await getLastClosingEnd(params.barbershopId, range.start, range.end)) ?? range.start;
  }

  if (periodStart >= periodEnd) {
    throw badRequest("O periodo inicial deve ser menor que o periodo final.");
  }

  return { periodStart, periodEnd };
}

async function listFinancialPayments(params: {
  barbershopId: string;
  periodStart: Date;
  periodEnd: Date;
  paymentIds?: string[];
}) {
  const byIds = params.paymentIds && params.paymentIds.length > 0
    ? Prisma.sql`AND p.id::text IN (${Prisma.join(params.paymentIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<PaymentRow[]>`
    SELECT
      p.id::text,
      p.user_id::text,
      u.name AS client_name,
      p.appointment_id::text,
      p.subscription_id::text,
      p.amount,
      p.method::text,
      p.status::text,
      p.paid_at,
      p.created_at,
      p.status_raw,
      a.start_at AS appointment_start_at,
      sp.name AS subscription_plan_name
    FROM payment_transactions p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN appointments a ON a.id = p.appointment_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE p.barbershop_id = ${params.barbershopId}::uuid
      AND p.status IN ('paid', 'approved')
      AND p.paid_at >= ${params.periodStart}
      AND p.paid_at <= ${params.periodEnd}
      AND NOT (p.appointment_id IS NOT NULL AND (p.method = 'subscription' OR p.status = 'covered'))
      ${byIds}
    ORDER BY p.paid_at ASC, p.created_at ASC
  `;

  return rows.map(serializePayment);
}

function summarizePayments(payments: ReturnType<typeof serializePayment>[]) {
  const totalsByMethod: Record<string, number> = {};
  let totalAmount = 0;

  for (const payment of payments) {
    totalAmount = roundMoney(totalAmount + payment.amount);
    totalsByMethod[payment.method] = roundMoney((totalsByMethod[payment.method] ?? 0) + payment.amount);
  }

  return {
    totalAmount,
    paymentCount: payments.length,
    totalsByMethod,
  };
}

export async function getCashClosingPreviewService(params: {
  barbershopId: string;
  date?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const { periodStart, periodEnd } = await resolvePeriod(params);
  const payments = await listFinancialPayments({
    barbershopId: params.barbershopId,
    periodStart,
    periodEnd,
  });

  return {
    periodStart,
    periodEnd,
    ...summarizePayments(payments),
    payments,
  };
}

export async function listCashClosingsService(params: {
  barbershopId: string;
  date?: string;
}) {
  const range = dayRange(params.date);
  const rows = await prisma.$queryRaw<ClosingRow[]>`
    SELECT
      c.id::text,
      c.period_start,
      c.period_end,
      c.closed_at,
      c.closed_by::text,
      u.name AS closed_by_name,
      c.total_amount,
      c.payment_count,
      c.totals_by_method,
      c.payment_ids,
      c.note
    FROM cash_closings c
    LEFT JOIN users u ON u.id = c.closed_by
    WHERE c.barbershop_id = ${params.barbershopId}::uuid
      AND c.closed_at >= ${range.start}
      AND c.closed_at <= ${range.end}
    ORDER BY c.closed_at DESC
  `;

  return rows.map(serializeClosing);
}

export async function createCashClosingService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    periodStart?: string;
    periodEnd?: string;
    note?: string | null;
  };
}) {
  const { periodStart, periodEnd } = await resolvePeriod({
    barbershopId: params.barbershopId,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
  });
  const payments = await listFinancialPayments({
    barbershopId: params.barbershopId,
    periodStart,
    periodEnd,
  });
  const summary = summarizePayments(payments);
  const paymentIds = payments.map((payment) => payment.id);
  const note = params.data.note?.trim() || null;

  const rows = await prisma.$queryRaw<ClosingRow[]>`
    INSERT INTO cash_closings (
      barbershop_id,
      period_start,
      period_end,
      closed_by,
      total_amount,
      payment_count,
      totals_by_method,
      payment_ids,
      note
    )
    VALUES (
      ${params.barbershopId}::uuid,
      ${periodStart},
      ${periodEnd},
      ${params.actorId}::uuid,
      ${summary.totalAmount},
      ${summary.paymentCount},
      CAST(${JSON.stringify(summary.totalsByMethod)} AS jsonb),
      CAST(${JSON.stringify(paymentIds)} AS jsonb),
      ${note}
    )
    RETURNING
      id::text,
      period_start,
      period_end,
      closed_at,
      closed_by::text,
      NULL::text AS closed_by_name,
      total_amount,
      payment_count,
      totals_by_method,
      payment_ids,
      note
  `;

  return {
    ...serializeClosing(rows[0]),
    payments,
  };
}

export async function getCashClosingReportService(params: {
  barbershopId: string;
  closingId: string;
}) {
  const rows = await prisma.$queryRaw<ClosingRow[]>`
    SELECT
      c.id::text,
      c.period_start,
      c.period_end,
      c.closed_at,
      c.closed_by::text,
      u.name AS closed_by_name,
      c.total_amount,
      c.payment_count,
      c.totals_by_method,
      c.payment_ids,
      c.note
    FROM cash_closings c
    LEFT JOIN users u ON u.id = c.closed_by
    WHERE c.barbershop_id = ${params.barbershopId}::uuid
      AND c.id = ${params.closingId}::uuid
    LIMIT 1
  `;

  const closing = rows[0];
  if (!closing) throw notFound("Fechamento de caixa nao encontrado.");

  const paymentIds = Array.isArray(closing.payment_ids)
    ? closing.payment_ids.map(String)
    : [];
  const payments = await listFinancialPayments({
    barbershopId: params.barbershopId,
    periodStart: closing.period_start,
    periodEnd: closing.period_end,
    paymentIds,
  });

  return {
    ...serializeClosing(closing),
    payments,
  };
}
