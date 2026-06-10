import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

const EMPLOYEE_PAYMENT_INCLUDE = {
  employee: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
} as const;

/* ───── LIST ───── */
export async function listEmployeePayments(
  barbershopId: string,
  employeeId?: string
) {
  const where: any = { barbershop_id: barbershopId };

  if (employeeId) {
    where.employee_id = employeeId;
  }

  return prisma.employee_payments.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

export async function findEmployeePaymentByPeriod(data: {
  barbershopId: string;
  employeeId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
}) {
  return prisma.employee_payments.findFirst({
    where: {
      barbershop_id: data.barbershopId,
      employee_id: data.employeeId,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
    },
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

export async function findLastEmployeePayment(data: {
  barbershopId: string;
  employeeId: string;
}) {
  return prisma.employee_payments.findFirst({
    where: {
      barbershop_id: data.barbershopId,
      employee_id: data.employeeId,
    },
    orderBy: {
      period_end: "desc",
    },
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

/* ───── CREATE ───── */
export async function createEmployeePayment(data: {
  employeeId: string;
  employeeName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  commission: number;
  totalVales: number;
  netAmount: number;
  paidBy: string;
  barbershopId: string;
}) {
  return prisma.employee_payments.create({
    data: {
      employee_id: data.employeeId,
      employee_name: data.employeeName,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      base_salary: data.baseSalary,
      commission: data.commission,
      total_vales: data.totalVales,
      net_amount: data.netAmount,
      paid_by: data.paidBy,
      barbershop_id: data.barbershopId,
    },
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

/* ───── INCREMENT COMMISSION ───── */
export async function incrementEmployeeCommissionByPeriod(data: {
  employeeId: string;
  employeeName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  commissionAmount: number;
  paidBy: string;
  paidAt: Date;
  barbershopId: string;
}) {
  const existing = await findEmployeePaymentByPeriod({
    barbershopId: data.barbershopId,
    employeeId: data.employeeId,
    period: data.period,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
  });

  if (existing) {
    return prisma.employee_payments.update({
      where: { id: existing.id },
      data: {
        employee_name: data.employeeName,
        commission: { increment: data.commissionAmount },
        net_amount: { increment: data.commissionAmount },
        paid_at: data.paidAt,
        paid_by: data.paidBy,
      },
      include: EMPLOYEE_PAYMENT_INCLUDE,
    });
  }

  return createEmployeePayment({
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    period: data.period,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    baseSalary: 0,
    commission: data.commissionAmount,
    totalVales: 0,
    netAmount: data.commissionAmount,
    paidBy: data.paidBy,
    barbershopId: data.barbershopId,
  });
}

export async function listPayrollEmployees(params: {
  barbershopId: string;
  employeeId?: string;
  role?: string;
}) {
  const where: Prisma.usersWhereInput = {
    current_barbershop_id: params.barbershopId,
    role: { in: ["admin", "barber", "receptionist"] as any[] },
  };

  if (params.employeeId) where.id = params.employeeId;
  if (params.role && params.role !== "all") where.role = params.role as any;

  return prisma.users.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_admin: true,
      photo_url: true,
      salary: true,
      barbers: {
        select: {
          id: true,
          display_name: true,
          specialty: true,
          salary: true,
          commission_percent: true,
        },
      },
    },
  });
}

export async function listCommissionAppointments(params: {
  barbershopId: string;
  periodStart: Date;
  periodEnd: Date;
  employeeId?: string;
}) {
  // Apenas atendimentos realizados (confirmed/completed) geram comissão — alinhado com a tela do barbeiro.
  // scheduled, cancelled e no_show são excluídos.
  return prisma.appointments.findMany({
    where: {
      barbershop_id: params.barbershopId,
      status: { in: ["confirmed", "completed"] as any[] },
      start_at: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
      ...(params.employeeId
        ? {
            barbers: {
              user_id: params.employeeId,
            },
          }
        : {}),
    },
    select: {
      id: true,
      start_at: true,
      barber_id: true,
      barbers: {
        select: {
          id: true,
          user_id: true,
          display_name: true,
          commission_percent: true,
        },
      },
      appointment_services: {
        select: {
          id: true,
          service_name: true,
          unit_price: true,
          quantity: true,
          services: {
            select: {
              comission_percent: true,
              covered_by_plan: true,
            },
          },
        },
      },
    },
  });
}

export async function listEmployeePaymentsByPeriod(params: {
  barbershopId: string;
  periodStart: string;
  periodEnd: string;
  employeeId?: string;
}) {
  // Usa paid_at (horário de Brasília) como referência, igual ao V1 que filtra por paidAt
  return prisma.employee_payments.findMany({
    where: {
      barbershop_id: params.barbershopId,
      paid_at: {
        gte: new Date(`${params.periodStart}T00:00:00-03:00`),
        lte: new Date(`${params.periodEnd}T23:59:59-03:00`),
      },
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
    },
    orderBy: { paid_at: "desc" },
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}
