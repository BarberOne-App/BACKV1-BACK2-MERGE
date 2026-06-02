import { badRequest, notFound } from "../errors/index.js";
import {
  createBlockedDate,
  deleteBlockedDate,
  findBlockedDateByDate,
  findBlockedDateByIdInBarbershop,
  listBlockedDatesInBarbershop,
  listBlockedDatesByDate,
  updateBlockedDate,
} from "../repository/blockedDateRepository.js";
import { findBarberByIdInBarbershop } from "../repository/barberRepository.js";
import { conflict } from "../errors/index.js";

/* ─────────────── helpers ─────────────── */

function serialize(bd: any) {
  return {
    id: bd.id,
    barbershopId: bd.barbershop_id,
    date: typeof bd.date === "string" ? bd.date : (bd.date as Date).toISOString().slice(0, 10),
    startTime: bd.start_time,
    endTime: bd.end_time,
    reason: bd.reason,
    barberId: bd.barber_id,
    barber: bd.barbers
      ? { id: bd.barbers.id, displayName: bd.barbers.display_name }
      : null,
    createdBy: bd.created_by,
    createdByUser: bd.users
      ? { id: bd.users.id, name: bd.users.name }
      : null,
    createdAt: bd.created_at,
    updatedAt: bd.updated_at,
  };
}

function serializeBlockedDate(bd: any) {
  return {
    id: bd.id,
    barbershopId: bd.barbershop_id,
    date:
      typeof bd.date === "string"
        ? bd.date
        : (bd.date as Date).toISOString().slice(0, 10),
    reason: bd.reason,
    barberId: bd.barber_id,
    startTime: bd.start_time,
    endTime: bd.end_time,
    barber: bd.barbers
      ? {
        id: bd.barbers.id,
        displayName: bd.barbers.display_name,
      }
      : null,
    createdBy: bd.created_by,
    createdByUser: bd.users
      ? {
        id: bd.users.id,
        name: bd.users.name,
      }
      : null,
    createdAt: bd.created_at,
    updatedAt: bd.updated_at,
  };
}

function normalizeTimeRange(data: { startTime?: string | null; endTime?: string | null }) {
  const startTime =
    data.startTime && String(data.startTime).trim() !== ""
      ? String(data.startTime).trim()
      : null;

  const endTime =
    data.endTime && String(data.endTime).trim() !== ""
      ? String(data.endTime).trim()
      : null;

  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw badRequest("Informe o horÃ¡rio inicial e final");
  }

  if (startTime && endTime && startTime >= endTime) {
    throw badRequest("O horÃ¡rio inicial deve ser menor que o final");
  }

  return { startTime, endTime, isTimeBlock: !!startTime && !!endTime };
}

function blockScopesOverlap(existingBarberId: string | null, nextBarberId: string | null) {
  return !existingBarberId || !nextBarberId || existingBarberId === nextBarberId;
}

function blockTimesOverlap(
  existingStart: string | null,
  existingEnd: string | null,
  nextStart: string | null,
  nextEnd: string | null,
) {
  if (!nextStart || !nextEnd) return true;
  if (!existingStart || !existingEnd) return true;
  return nextStart < existingEnd && nextEnd > existingStart;
}

/* ───────── LIST ───────── */
export async function listBlockedDatesService(params: {
  barbershopId: string;
  query: {
    dateFrom?: string;
    dateTo?: string;
    barberId?: string;
  };
}) {
  const items = await listBlockedDatesInBarbershop({
    barbershopId: params.barbershopId,
    dateFrom: params.query.dateFrom,
    dateTo: params.query.dateTo,
    barberId: params.query.barberId,
  });

  return items.map(serialize);
}

/* ───────── CHECK DATE ───────── */
export async function checkBlockedDateService(params: {
  barbershopId: string;
  date: string;
  barberId?: string;
}) {
  const items = await findBlockedDateByDate(
    params.barbershopId,
    params.date,
    params.barberId
  );

  return {
    blocked: items.length > 0,
    items: items.map(serialize),
  };
}

/* ───────── CREATE ───────── */
// export async function createBlockedDateService(params: {
//   barbershopId: string;
//   actorId: string;
//   data: {
//     date: string;
//     reason?: string | null;
//     barberId?: string | null;
//   };
// }) {
//   // Validar que a data não é no passado
//   const dateObj = new Date(params.data.date + "T00:00:00Z");
//   const today = new Date();
//   today.setUTCHours(0, 0, 0, 0);
//   if (dateObj < today) {
//     throw badRequest("Não é possível bloquear uma data no passado");
//   }

//   // Validar barbeiro se informado
//   if (params.data.barberId) {
//     const barber = await findBarberByIdInBarbershop(params.barbershopId, params.data.barberId);
//     if (!barber) throw notFound("Barbeiro não encontrado");
//   }

//   const created = await createBlockedDate({
//     barbershopId: params.barbershopId,
//     date: dateObj,
//     reason: params.data.reason,
//     barberId: params.data.barberId,
//     createdBy: params.actorId,
//   });

//   return serialize(created);
// }

export async function createBlockedDateService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    date: string;
    reason?: string | null;
    barberId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  };
}) {
  const dateObj = new Date(params.data.date + "T00:00:00.000Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (dateObj < today) {
    throw badRequest("Não é possível bloquear uma data no passado");
  }

  if (params.data.barberId) {
    const barber = await findBarberByIdInBarbershop(
      params.barbershopId,
      params.data.barberId
    );

    if (!barber) {
      throw notFound("Barbeiro não encontrado");
    }
  }

  const { startTime, endTime, isTimeBlock } = normalizeTimeRange(params.data);

  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw badRequest("Informe o horário inicial e final");
  }

  if (startTime && endTime && startTime >= endTime) {
    throw badRequest("O horário inicial deve ser menor que o final");
  }

  const existingBlocks = await listBlockedDatesByDate({
    barbershopId: params.barbershopId,
    date: dateObj,
    barberId: params.data.barberId ?? null,
  });

  const hasConflict = existingBlocks.some((block) => {
    const existingStart = block.start_time || null;
    const existingEnd = block.end_time || null;

    const scopesOverlap = blockScopesOverlap(block.barber_id ?? null, params.data.barberId ?? null);

    if (!scopesOverlap) return false;

    // se o novo for dia inteiro, conflita com qualquer bloqueio do mesmo dia/barbeiro
    if (!isTimeBlock) return true;

    // se já existe um bloqueio de dia inteiro, conflita
    if (!existingStart || !existingEnd) return true;

    // conflito de faixa
    return blockTimesOverlap(existingStart, existingEnd, startTime, endTime);
  });

  if (hasConflict) {
    throw conflict(
      isTimeBlock
        ? "Já existe um bloqueio nesse intervalo"
        : "Essa data já está bloqueada"
    );
  }

  const created = await createBlockedDate({
    barbershopId: params.barbershopId,
    date: dateObj,
    reason: params.data.reason ?? null,
    barberId: params.data.barberId ?? null,
    startTime,
    endTime,
    createdBy: params.actorId,
  });

  return serializeBlockedDate(created);
}

/* ───────── DELETE ───────── */
export async function updateBlockedDateService(params: {
  barbershopId: string;
  blockedDateId: string;
  data: {
    date: string;
    reason?: string | null;
    barberId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  };
}) {
  const existing = await findBlockedDateByIdInBarbershop(params.barbershopId, params.blockedDateId);
  if (!existing) throw notFound("Data bloqueada nÃ£o encontrada");

  const dateObj = new Date(params.data.date + "T00:00:00.000Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (dateObj < today) {
    throw badRequest("NÃ£o Ã© possÃ­vel bloquear uma data no passado");
  }

  if (params.data.barberId) {
    const barber = await findBarberByIdInBarbershop(params.barbershopId, params.data.barberId);
    if (!barber) throw notFound("Barbeiro nÃ£o encontrado");
  }

  const { startTime, endTime, isTimeBlock } = normalizeTimeRange(params.data);
  const existingBlocks = await listBlockedDatesByDate({
    barbershopId: params.barbershopId,
    date: dateObj,
    barberId: params.data.barberId ?? null,
  });

  const hasConflict = existingBlocks.some((block) => {
    if (block.id === params.blockedDateId) return false;
    const existingStart = block.start_time || null;
    const existingEnd = block.end_time || null;

    return (
      blockScopesOverlap(block.barber_id ?? null, params.data.barberId ?? null) &&
      blockTimesOverlap(existingStart, existingEnd, startTime, endTime)
    );
  });

  if (hasConflict) {
    throw conflict(
      isTimeBlock
        ? "JÃ¡ existe um bloqueio nesse intervalo"
        : "Essa data jÃ¡ estÃ¡ bloqueada"
    );
  }

  const updated = await updateBlockedDate({
    barbershopId: params.barbershopId,
    id: params.blockedDateId,
    date: dateObj,
    reason: params.data.reason ?? null,
    barberId: params.data.barberId ?? null,
    startTime,
    endTime,
  });

  return serializeBlockedDate(updated);
}

export async function deleteBlockedDateService(params: {
  barbershopId: string;
  blockedDateId: string;
}) {
  // Verificar existência
  const existing = await findBlockedDateByIdInBarbershop(params.barbershopId, params.blockedDateId);
  if (!existing) throw notFound("Data bloqueada não encontrada");

  await deleteBlockedDate(params.barbershopId, params.blockedDateId);
  return { message: "Data desbloqueada com sucesso" };
}
