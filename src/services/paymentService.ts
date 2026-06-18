import { forbidden, notFound } from "../errors/index.js";
import prisma from "../database/database.js";
import {
  createPaymentInBarbershop,
  deletePaymentInBarbershop,
  findPaymentByIdInBarbershop,
  getPaymentSummary,
  listPaymentsInBarbershop,
  updatePaymentInBarbershop,
} from "../repository/paymentRepository.js";

function decimalToNumber(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function serialize(p: any) {
  return {
    id: p.id,
    barbershopId: p.barbershop_id,
    userId: p.user_id,
    user: p.users
      ? {
          id: p.users.id,
          name: p.users.name,
          email: p.users.email,
          phone: p.users.phone,
        }
      : null,
    appointmentId: p.appointment_id,
    appointment: p.appointments
      ? {
          id: p.appointments.id,
          startAt: p.appointments.start_at,
          endAt: p.appointments.end_at,
          status: p.appointments.status,
          barber: p.appointments.barbers
            ? {
                id: p.appointments.barbers.id,
                displayName: p.appointments.barbers.display_name,
              }
            : null,
          services: Array.isArray(p.appointments.appointment_services)
            ? p.appointments.appointment_services.map((service: any) => {
                const unitPrice = decimalToNumber(service.unit_price);
                const quantity = Number(service.quantity ?? 1);

                return {
                  id: service.id,
                  serviceName: service.service_name,
                  unitPrice,
                  quantity,
                  totalPrice: unitPrice * quantity,
                };
              })
            : [],
        }
      : null,
    subscriptionId: p.subscription_id,
    subscription: p.subscriptions
      ? {
          id: p.subscriptions.id,
          status: p.subscriptions.status,
          plan: p.subscriptions.subscription_plans
            ? {
                id: p.subscriptions.subscription_plans.id,
                name: p.subscriptions.subscription_plans.name,
              }
            : null,
        }
      : null,
    amount: decimalToNumber(p.amount),
    method: p.method,
    status: p.status,
    statusRaw: p.status_raw,
    paidAt: p.paid_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function listPaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  query: {
    userId?: string;
    subscriptionId?: string;
    status?: string;
    method?: string;
    page?: number;
    limit?: number;
  };
}) {
  let userId = params.query.userId;
  if (params.actorRole === "client") userId = params.actorId;

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const { items, total } = await listPaymentsInBarbershop({
    barbershopId: params.barbershopId,
    userId,
    subscriptionId: params.query.subscriptionId,
    status: params.query.status,
    method: params.query.method,
    type: "subscription",
    page,
    limit,
  });

  return { page, limit, total, items: items.map(serialize) };
}

export async function listAllPaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  query: {
    userId?: string;
    status?: string;
    method?: string;
    page?: number;
    limit?: number;
  };
}) {
  let userId = params.query.userId;
  if (params.actorRole === "client") userId = params.actorId;

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const [{ items, total }, summary] = await Promise.all([
    listPaymentsInBarbershop({
      barbershopId: params.barbershopId,
      userId,
      status: params.query.status,
      method: params.query.method,
      page,
      limit,
    }),
    getPaymentSummary(params.barbershopId),
  ]);

  return {
    page,
    limit,
    total,
    summary,
    items: items.map((item) => ({
      ...serialize(item),
      paymentType: item.appointment_id ? "appointment" : "subscription",
    })),
  };
}

export async function getPaymentByIdService(params: {
  barbershopId: string;
  paymentId: string;
}) {
  const p = await findPaymentByIdInBarbershop(
    params.barbershopId,
    params.paymentId
  );

  if (!p) throw notFound("Pagamento não encontrado");

  return serialize(p);
}

export async function createPaymentService(params: {
  barbershopId: string;
  data: {
    userId: string;
    subscriptionId?: string;
    appointmentId?: string;
    amount: number;
    method: string;
    status?: string;
  };
}) {
  const created = await createPaymentInBarbershop({
    barbershopId: params.barbershopId,
    userId: params.data.userId,
    subscriptionId: params.data.subscriptionId,
    appointmentId: params.data.appointmentId,
    amount: params.data.amount,
    method: params.data.method,
    status: params.data.status,
  });

  return serialize(created);
}

export async function listAppointmentPaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  query: {
    appointmentId?: string;
    userId?: string;
    status?: string;
    page?: number;
    limit?: number;
  };
}) {
  let userId = params.query.userId;
  if (params.actorRole === "client") userId = params.actorId;

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const { items, total } = await listPaymentsInBarbershop({
    barbershopId: params.barbershopId,
    userId,
    appointmentId: params.query.appointmentId,
    status: params.query.status,
    type: "appointment",
    page,
    limit,
  });

  return { page, limit, total, items: items.map(serialize) };
}

export async function createAppointmentPaymentService(params: {
  barbershopId: string;
  data: {
    appointmentId: string;
    userId: string;
    amount: number;
    method?: string;
    status?: string;
  };
}) {
  const created = await createPaymentInBarbershop({
    barbershopId: params.barbershopId,
    userId: params.data.userId,
    appointmentId: params.data.appointmentId,
    amount: params.data.amount,
    method: params.data.method,
    status: params.data.status,
  });

  return serialize(created);
}

/* ═══════════ EXTRA PAYMENTS ═══════════ */

function serializeExtra(p: any) {
  return {
    ...serialize(p),
    description: p.status_raw ?? null,
  };
}

export async function listExtraPaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  query: {
    userId?: string;
    status?: string;
    method?: string;
    page?: number;
    limit?: number;
  };
}) {
  if (params.actorRole !== "admin" && params.actorRole !== "receptionist") {
    throw forbidden("Sem permissão para listar pagamentos extras");
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const { items, total } = await listPaymentsInBarbershop({
    barbershopId: params.barbershopId,
    userId: params.query.userId,
    status: params.query.status,
    method: params.query.method,
    type: "extra",
    page,
    limit,
  });

  return { page, limit, total, items: items.map(serializeExtra) };
}

export async function createExtraPaymentService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    userId?: string | null;
    amount: number;
    method: string;
    status?: string;
    description?: string | null;
  };
}) {
  if (params.actorRole !== "admin" && params.actorRole !== "receptionist") {
    throw forbidden("Sem permissão para criar pagamentos extras");
  }

  const created = await createPaymentInBarbershop({
    barbershopId: params.barbershopId,
    userId: params.data.userId ?? undefined,
    amount: params.data.amount,
    method: params.data.method,
    status: params.data.status,
    statusRaw: params.data.description ?? undefined,
  });

  return serializeExtra(created);
}

export async function deleteExtraPaymentService(params: {
  barbershopId: string;
  actorRole: string;
  paymentId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode remover pagamentos extras");
  }

  const existing = await findPaymentByIdInBarbershop(params.barbershopId, params.paymentId);
  if (!existing) throw notFound("Pagamento não encontrado");

  if (existing.appointment_id || existing.subscription_id) {
    throw forbidden("Apenas pagamentos extras (sem agendamento ou assinatura) podem ser removidos aqui");
  }

  const deleted = await deletePaymentInBarbershop(params.barbershopId, params.paymentId);
  if (!deleted) throw notFound("Pagamento não encontrado");

  return { ok: true };
}

export async function updatePaymentService(params: {
  barbershopId: string;
  paymentId: string;
  actorId: string;
  data: {
    status?: string;
    method?: string;
    paidAt?: Date;
    noShow?: boolean;
  };
}) {
  const existing = await findPaymentByIdInBarbershop(
    params.barbershopId,
    params.paymentId
  );

  if (!existing) throw notFound("Pagamento não encontrado");

  const updateData: any = {};

  if (params.data.status !== undefined) updateData.status = params.data.status;
  if (params.data.method !== undefined) updateData.method = params.data.method;
  if (params.data.paidAt !== undefined) updateData.paid_at = params.data.paidAt;

  if (params.data.noShow !== undefined) {
    updateData.status_raw = params.data.noShow ? "no_show" : null;
  }

  if (params.data.status === "paid" && !params.data.paidAt) {
    updateData.paid_at = new Date();
  }

  const updated = await updatePaymentInBarbershop(
    params.barbershopId,
    params.paymentId,
    updateData
  );

  if (!updated) throw notFound("Pagamento não encontrado");

  if (
    (params.data.status === "paid" || params.data.status === "covered") &&
    updated.appointment_id
  ) {
    await prisma.appointments.update({
      where: { id: updated.appointment_id },
      data: { status: "confirmed" },
    });
  }

  return serialize(updated);
}
