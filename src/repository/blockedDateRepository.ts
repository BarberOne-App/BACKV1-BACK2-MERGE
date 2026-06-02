import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listBlockedDatesInBarbershop(params: {
  barbershopId: string;
  dateFrom?: string;
  dateTo?: string;
  barberId?: string;
}) {
  const where: any = { barbershop_id: params.barbershopId };

  if (params.barberId) {
    // retornar bloqueios gerais (barber_id = null) + do barbeiro específico
    where.OR = [{ barber_id: null }, { barber_id: params.barberId }];
  }

  if (params.dateFrom || params.dateTo) {
    where.date = {};
    if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
    if (params.dateTo) where.date.lte = new Date(params.dateTo);
  }

  return prisma.blocked_dates.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      barbers: { select: { id: true, display_name: true } },
      users: { select: { id: true, name: true } },
    },
  });
}

export async function listBlockedDatesByDate(params: {
  barbershopId: string;
  date: Date;
  barberId?: string | null;
}) {
  const where: any = {
    barbershop_id: params.barbershopId,
    date: params.date,
  };

  if (params.barberId) {
    where.OR = [{ barber_id: null }, { barber_id: params.barberId }];
  }

  return prisma.blocked_dates.findMany({
    where,
    orderBy: {
      created_at: "asc",
    },
  });
}

/* ───── FIND BY DATE ───── */
export async function findBlockedDateByDate(
  barbershopId: string,
  date: string,
  barberId?: string
) {
  const where: any = {
    barbershop_id: barbershopId,
    date: new Date(date),
  };

  if (barberId) {
    where.OR = [{ barber_id: null }, { barber_id: barberId }];
    // remove o campo date de where original e coloque com AND
    delete where.OR;
    return prisma.blocked_dates.findMany({
      where: {
        barbershop_id: barbershopId,
        date: new Date(date),
        OR: [{ barber_id: null }, { barber_id: barberId }],
      },
      include: {
        barbers: { select: { id: true, display_name: true } },
        users: { select: { id: true, name: true } },
      },
    });
  }

  return prisma.blocked_dates.findMany({
    where,
    include: {
      barbers: { select: { id: true, display_name: true } },
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── FIND BY ID ───── */
export async function findBlockedDateByIdInBarbershop(
  barbershopId: string,
  id: string
) {
  return prisma.blocked_dates.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: {
      barbers: { select: { id: true, display_name: true } },
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── CREATE ───── */
// export async function createBlockedDate(data: {
//   barbershopId: string;
//   date: Date;
//   reason?: string | null;
//   barberId?: string | null;
//   createdBy: string;
// }) {
//   return prisma.blocked_dates.create({
//     data: {
//       barbershop_id: data.barbershopId,
//       date: data.date,
//       reason: data.reason ?? null,
//       barber_id: data.barberId ?? null,
//       created_by: data.createdBy,
//     },
//     include: {
//       barbers: { select: { id: true, display_name: true } },
//       users: { select: { id: true, name: true } },
//     },
//   });
// }

export async function createBlockedDate(data: {
  barbershopId: string;
  date: Date;
  reason?: string | null;
  barberId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  createdBy: string;
}) {
  return prisma.blocked_dates.create({
    data: {
      barbershop_id: data.barbershopId,
      date: data.date,
      reason: data.reason ?? null,
      barber_id: data.barberId ?? null,
      start_time: data.startTime ?? null,
      end_time: data.endTime ?? null,
      created_by: data.createdBy,
    },
    include: {
      barbers: { select: { id: true, display_name: true } },
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── DELETE ───── */
export async function updateBlockedDate(data: {
  barbershopId: string;
  id: string;
  date: Date;
  reason?: string | null;
  barberId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}) {
  return prisma.blocked_dates.update({
    where: { id: data.id },
    data: {
      date: data.date,
      reason: data.reason ?? null,
      barber_id: data.barberId ?? null,
      start_time: data.startTime ?? null,
      end_time: data.endTime ?? null,
      updated_at: new Date(),
    },
    include: {
      barbers: { select: { id: true, display_name: true } },
      users: { select: { id: true, name: true } },
    },
  });
}

export async function deleteBlockedDate(barbershopId: string, id: string) {
  return prisma.blocked_dates.deleteMany({
    where: { id, barbershop_id: barbershopId },
  });
}
