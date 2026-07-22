import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

/* ── select padrão ── */
const appointmentSelect = {
  id: true,
  barber_id: true,
  client_id: true,
  dependent_id: true,
  start_at: true,
  end_at: true,
  status: true,
  notes: true,
  barbershop_id: true,
  created_at: true,
  updated_at: true,
  barbers: {
    select: { id: true, display_name: true, photo_url: true, commission_percent: true },
  },
  users: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      subscriptions: {
        select: {
          id: true,
          barbershop_id: true,
          status: true,
          days_overdue: true,
          next_billing_at: true,
          subscription_plans: {
            select: { id: true, name: true },
          },
        },
        orderBy: { created_at: "desc" },
      },
    },
  },
  dependents: {
    select: { id: true, name: true, age: true },
  },
  barbershops: {
    select: { id: true, name: true, email: true, phone: true },
  },
  appointment_services: {
    select: {
      id: true,
      service_id: true,
      service_name: true,
      unit_price: true,
      duration_minutes: true,
      quantity: true,
      services: {
        select: {
          comission_percent: true,
          covered_by_plan: true,
        },
      },
    },
  },
  appointment_products: {
    select: {
      id: true,
      product_id: true,
      product_name: true,
      unit_price: true,
      discount_percent: true,
      quantity: true,
    },
  },
} satisfies Prisma.appointmentsSelect;

function getSaoPauloDayRange(date: string) {
  return {
    dayStart: new Date(`${date}T00:00:00-03:00`),
    dayEnd: new Date(`${date}T24:00:00-03:00`),
  };
}

/* ── LIST ── */
export async function listAppointmentsInBarbershop(params: {
  barbershopId: string;
  barberId?: string;
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.appointmentsWhereInput = {
    barbershop_id: params.barbershopId,
  };

  if (params.barberId) where.barber_id = params.barberId;
  if (params.clientId) where.client_id = params.clientId;
  if (params.status) {
    where.status =
      params.status === "active"
        ? { in: ["scheduled", "confirmed"] as any }
        : (params.status as any);
  }

  if (params.dateFrom || params.dateTo) {
    where.start_at = {};
    const gteDate = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00-03:00`) : undefined;
    const lteDate = params.dateTo ? new Date(`${params.dateTo}T23:59:59-03:00`) : undefined;
    if (gteDate) (where.start_at as Prisma.DateTimeFilter).gte = gteDate;
    if (lteDate) (where.start_at as Prisma.DateTimeFilter).lte = lteDate;

    // DEBUG LOG — remover após validação
    console.log("[listAppointments] date filter (SP timezone)", {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      gteUTC: gteDate?.toISOString(),
      lteUTC: lteDate?.toISOString(),
    });
  }

  const skip = (params.page - 1) * params.limit;

  // const [items, total] = await Promise.all([
  //   prisma.appointments.findMany({
  //     where,
  //     select: appointmentSelect,
  //     orderBy: { start_at: "asc" },
  //     take: params.limit,
  //     skip,
  //   }),
  //   prisma.appointments.count({ where }),
  // ]);

  const [items, total] = await prisma.$transaction([
    prisma.appointments.findMany({
      where,
      select: appointmentSelect,
      orderBy: { start_at: "asc" },
      take: params.limit,
      skip,
    }),
    prisma.appointments.count({ where }),
  ]);

  return { items, total };
}

/* ── GET BY ID ── */
export async function findAppointmentByIdInBarbershop(
  barbershopId: string,
  appointmentId: string
) {
  return prisma.appointments.findFirst({
    where: {
      id: appointmentId,
      barbershop_id: barbershopId,
    },
    select: appointmentSelect,
  });
}

export async function getAppointmentByIdInBarbershop(
  barbershopId: string,
  appointmentId: string
) {
  return findAppointmentByIdInBarbershop(barbershopId, appointmentId);
}

/* ── CREATE (transação: appointment + services + products) ── */
export async function createAppointmentTx(data: {
  barbershopId: string;
  barberId: string;
  clientId: string;
  dependentId?: string | null;
  startAt: Date;
  endAt: Date;
  notes?: string | null;
  lastModifiedBy?: string | null;
  lastActionDescription?: string | null;
  allowsBarberOverlap?: boolean;
  status?: string;
  services: {
    serviceId: string;
    serviceName: string;
    unitPrice: number;
    durationMinutes: number;
    quantity: number;
  }[];
  products: {
    productId: string;
    productName: string;
    unitPrice: number;
    discountPercent: number;
    quantity: number;
  }[];
}) {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointments.create({
      data: {
        barbershop_id: data.barbershopId,
        barber_id: data.barberId,
        client_id: data.clientId,
        dependent_id: data.dependentId ?? null,
        start_at: data.startAt,
        end_at: data.endAt,
        notes: data.notes ?? null,
        last_modified_by: data.lastModifiedBy ?? null,
        last_action_description: data.lastActionDescription ?? null,
        allows_barber_overlap: data.allowsBarberOverlap ?? false,
        status: (data.status as any) ?? "scheduled",
        appointment_services: {
          create: data.services.map((s) => ({
            service_id: s.serviceId,
            service_name: s.serviceName,
            unit_price: s.unitPrice,
            duration_minutes: s.durationMinutes,
            quantity: s.quantity,
          })),
        },
        appointment_products: {
          create: data.products.map((p) => ({
            product_id: p.productId,
            product_name: p.productName,
            unit_price: p.unitPrice,
            discount_percent: p.discountPercent,
            quantity: p.quantity,
          })),
        },
      },
      select: appointmentSelect,
    });

    for (const p of data.products) {
      await tx.products.update({
        where: { id: p.productId },
        data: {
          stock: { decrement: p.quantity },
        },
      });
    }

    return appointment;
  });
}

/* ── UPDATE (parcial — status, notes, barberId) ── */
export async function updateAppointmentInBarbershop(
  barbershopId: string,
  appointmentId: string,
  data: Prisma.appointmentsUpdateInput
) {
  const existing = await findAppointmentByIdInBarbershop(barbershopId, appointmentId);
  if (!existing) return null;

  return prisma.appointments.update({
    where: { id: appointmentId },
    data: {
      ...data,
      updated_at: new Date(),
    },
    select: appointmentSelect,
  });
}

/* ── CANCEL (soft delete) ── */
export async function cancelAppointmentInBarbershop(
  barbershopId: string,
  appointmentId: string
) {
  const existing = await findAppointmentByIdInBarbershop(barbershopId, appointmentId);
  if (!existing) return null;

  return prisma.appointments.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      updated_at: new Date(),
    },
    select: appointmentSelect,
  });
}

/* ── BUSCAR AGENDAMENTOS DO BARBEIRO NA DATA (para cálculo de slots) ── */
export async function getBarberAppointmentsForDate(
  barbershopId: string,
  barberId: string,
  date: string
) {
  const { dayStart, dayEnd } = getSaoPauloDayRange(date);

  return prisma.appointments.findMany({
    where: {
      barbershop_id: barbershopId,
      barber_id: barberId,
      start_at: { lt: dayEnd },
      end_at: { gt: dayStart },
      status: { notIn: ["cancelled", "no_show"] },
    },
    select: {
      id: true,
      start_at: true,
      end_at: true,
    },
    orderBy: { start_at: "asc" },
  });
}

export async function getClientAppointmentsForDate(params: {
  barbershopId: string;
  clientId: string;
  date: string;
  dependentId?: string | null;
}) {
  const { dayStart, dayEnd } = getSaoPauloDayRange(params.date);

  const ownerWhere: Prisma.appointmentsWhereInput = params.dependentId
    ? {
      dependent_id: params.dependentId,
    }
    : {
      client_id: params.clientId,
      dependent_id: null,
    };

  return prisma.appointments.findMany({
    where: {
      barbershop_id: params.barbershopId,
      start_at: { lt: dayEnd },
      end_at: { gt: dayStart },
      status: { notIn: ["cancelled", "no_show"] },
      ...ownerWhere,
    },
    select: {
      id: true,
      barber_id: true,
      start_at: true,
      end_at: true,
    },
    orderBy: { start_at: "asc" },
  });
}
