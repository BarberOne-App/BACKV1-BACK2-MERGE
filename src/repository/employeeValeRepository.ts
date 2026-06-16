import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listEmployeeVales(barbershopId: string) {
  return prisma.employee_vales.findMany({
    where: { barbershop_id: barbershopId },
    orderBy: { created_at: "desc" },
    include: {
      users_employee_vales_employee_idTousers: { select: { id: true, name: true } },
      users_employee_vales_created_byTousers: { select: { id: true, name: true } },
    },
  });
}

export async function listEmployeeValesByPeriod(params: {
  barbershopId: string;
  employeeId?: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return prisma.employee_vales.findMany({
    where: {
      barbershop_id: params.barbershopId,
      ...(params.employeeId ? { employee_id: params.employeeId } : {}),
      date: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
    },
    orderBy: { date: "desc" },
    include: {
      users_employee_vales_employee_idTousers: { select: { id: true, name: true } },
      users_employee_vales_created_byTousers: { select: { id: true, name: true } },
    },
  });
}

/* ───── FIND BY ID ───── */
export async function findEmployeeValeById(barbershopId: string, id: string) {
  return prisma.employee_vales.findFirst({
    where: { id, barbershop_id: barbershopId },
  });
}

/* ───── CREATE ───── */
export async function createEmployeeVale(data: {
  employeeId: string;
  amount: number;
  note?: string | null;
  date: Date;
  createdBy: string;
  barbershopId: string;
}) {
  return prisma.employee_vales.create({
    data: {
      employee_id: data.employeeId,
      amount: data.amount,
      note: data.note ?? null,
      date: data.date,
      created_by: data.createdBy,
      barbershop_id: data.barbershopId,
    },
    include: {
      users_employee_vales_employee_idTousers: { select: { id: true, name: true } },
      users_employee_vales_created_byTousers: { select: { id: true, name: true } },
    },
  });
}

/* ───── DELETE ───── */
export async function deleteEmployeeVale(barbershopId: string, id: string) {
  return prisma.employee_vales.deleteMany({
    where: { id, barbershop_id: barbershopId },
  });
}
