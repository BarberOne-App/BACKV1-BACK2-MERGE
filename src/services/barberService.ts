// import { forbidden, notFound } from "../errors/index.js";
// import { ensureCanAddRole } from "./planLimitService.js";
// import {
//   createBarberInBarbershop,
//   deleteBarberFromBarbershop,
//   findBarberByIdInBarbershop,
//   linkBarberToUser,
//   listBarbersInBarbershop,
//   replaceBarberServices,
//   updateBarberInBarbershop,
// } from "../repository/barberRepository.js";
// import { findUserByIdInBarbershop } from "../repository/userRepository.js";
// import prisma from "../database/database.js";

// function serializeBarber(b: any) {
//   return {
//     id: b.id,
//     displayName: b.display_name,
//     specialty: b.specialty,
//     photoUrl: b.photo_url,
//     commissionPercent: b.commission_percent,
//     userId: b.user_id,
//     barbershopId: b.barbershop_id,
//     salarioFixo: b.salary,
//     serviceIds: Array.isArray(b.barber_services)
//       ? b.barber_services.map((item: any) => item.service_id)
//       : [],
//     createdAt: b.created_at,
//     updatedAt: b.updated_at,
//     user: b.users
//       ? {
//           id: b.users.id,
//           name: b.users.name,
//           email: b.users.email,
//           phone: b.users.phone,
//           role: b.users.role,
//           isAdmin: b.users.is_admin,
//         }
//       : null,
//   };
// }

// /* ── LIST ── */
// export async function listBarbersService(params: {
//   barbershopId: string;
//   query: { q?: string; page?: number; limit?: number };
// }) {
//   const page = params.query.page ?? 1;
//   const limit = params.query.limit ?? 20;

//   const { items, total } = await listBarbersInBarbershop({
//     barbershopId: params.barbershopId,
//     q: params.query.q?.trim(),
//     page,
//     limit,
//   });

//   return {
//     page,
//     limit,
//     total,
//     items: items.map(serializeBarber),
//   };
// }

// /* ── GET BY ID ── */
// export async function getBarberByIdService(params: {
//   barbershopId: string;
//   barberId: string;
// }) {
//   const barber = await findBarberByIdInBarbershop(params.barbershopId, params.barberId);
//   if (!barber) throw notFound("Barbeiro não encontrado");
//   return serializeBarber(barber);
// }

// /* ── CREATE ── */
// export async function createBarberService(params: {
//   barbershopId: string;
//   actorRole: string;
//   data: {
//     displayName: string;
//     specialty?: string | null;
//     photoUrl?: string | null;
//     salarioFixo?: number | null;
//     commissionPercent?: number | null;
//     userId?: string | null;
//     serviceIds?: string[];
//   };
// }) {
//   if (params.actorRole !== "admin") {
//     throw forbidden("Apenas admin pode criar barbeiros");
//   }

//   // Se um userId foi fornecido, validar que o user existe na barbearia
//   if (params.data.userId) {
//     const user = await findUserByIdInBarbershop(params.barbershopId, params.data.userId);
//     if (!user) throw notFound("Usuário informado não encontrado nesta barbearia");
//   }

//   // Verifica limites do plano antes de criar barbeiro
//   await ensureCanAddRole(params.barbershopId, "barber", 1);

//   if (Array.isArray(params.data.serviceIds) && params.data.serviceIds.length > 0) {
//     const count = await prisma.services.count({
//       where: {
//         barbershop_id: params.barbershopId,
//         id: { in: params.data.serviceIds },
//       },
//     });

//     if (count !== params.data.serviceIds.length) {
//       throw notFound("Um ou mais serviços informados não existem nesta barbearia");
//     }
//   }

//   const barber = await createBarberInBarbershop({
//     barbershopId: params.barbershopId,
//     displayName: params.data.displayName.trim(),
//     specialty: params.data.specialty ?? null,
//     photoUrl: params.data.photoUrl ?? null,
//     commissionPercent: params.data.commissionPercent ?? null,
//     salarioFixo: params.data.salarioFixo ?? null,
//     userId: params.data.userId ?? null,
//     serviceIds: params.data.serviceIds ?? [],
//   });

//   return serializeBarber(barber);
// }

// /* ── UPDATE ── */
// export async function updateBarberService(params: {
//   barbershopId: string;
//   actorRole: string;
//   barberId: string;
//   data: {
//     displayName?: string;
//     specialty?: string | null;
//     photoUrl?: string | null;
//     commissionPercent?: number | null;
//     salarioFixo?: number | null;
//     serviceIds?: string[];
//   };
// }) {
//   if (params.actorRole !== "admin") {
//     throw forbidden("Apenas admin pode editar barbeiros");
//   }

//   const updateData: any = {};

//   if (params.data.displayName !== undefined) updateData.display_name = params.data.displayName.trim();
//   if (params.data.specialty !== undefined) updateData.specialty = params.data.specialty ?? null;
//   if (params.data.photoUrl !== undefined) updateData.photo_url = params.data.photoUrl ?? null;
//   if (params.data.commissionPercent !== undefined) updateData.commission_percent = params.data.commissionPercent ?? null;
//   if (params.data.salarioFixo !== undefined) updateData.salary = params.data.salarioFixo ?? null;
//   if (params.data.serviceIds !== undefined) {
//     const sanitizedServiceIds = Array.isArray(params.data.serviceIds)
//       ? params.data.serviceIds.map((id) => String(id))
//       : [];

//     if (sanitizedServiceIds.length > 0) {
//       const count = await prisma.services.count({
//         where: {
//           barbershop_id: params.barbershopId,
//           id: { in: sanitizedServiceIds },
//         },
//       });

//       if (count !== sanitizedServiceIds.length) {
//         throw notFound("Um ou mais serviços informados não existem nesta barbearia");
//       }
//     }

//     const withServices = await replaceBarberServices(
//       params.barbershopId,
//       params.barberId,
//       sanitizedServiceIds,
//     );

//     if (!withServices) throw notFound("Barbeiro não encontrado");

//     if (Object.keys(updateData).length === 0) {
//       return serializeBarber(withServices);
//     }
//   }

//   const updated = await updateBarberInBarbershop(params.barbershopId, params.barberId, updateData);
//   if (!updated) throw notFound("Barbeiro não encontrado");

//   return serializeBarber(updated);
// }

// /* ── LINK USER ── */
// export async function linkBarberToUserService(params: {
//   barbershopId: string;
//   actorRole: string;
//   barberId: string;
//   userId: string;
// }) {
//   if (params.actorRole !== "admin") {
//     throw forbidden("Apenas admin pode vincular barbeiro a usuário");
//   }

//   // Valida que o user existe na barbearia
//   const user = await findUserByIdInBarbershop(params.barbershopId, params.userId);
//   if (!user) throw notFound("Usuário não encontrado nesta barbearia");

//   const linked = await linkBarberToUser(params.barbershopId, params.barberId, params.userId);
//   if (!linked) throw notFound("Barbeiro não encontrado");

//   return serializeBarber(linked);
// }

// /* ── DELETE ── */
// export async function deleteBarberService(params: {
//   barbershopId: string;
//   actorRole: string;
//   barberId: string;
// }) {
//   if (params.actorRole !== "admin") {
//     throw forbidden("Apenas admin pode remover barbeiros");
//   }

//   const deleted = await deleteBarberFromBarbershop(params.barbershopId, params.barberId);
//   if (!deleted) throw notFound("Barbeiro não encontrado");

//   return { ok: true };
// }


import { conflict, forbidden, notFound } from "../errors/index.js";
import {
  createBarberInBarbershop,
  deleteBarberFromBarbershop,
  findBarberByIdInBarbershop,
  findBarberByUserIdInBarbershop,
  linkBarberToUser,
  listBarbersInBarbershop,
  replaceBarberServices,
  updateBarberInBarbershop,
} from "../repository/barberRepository.js";
import { findUserByIdInBarbershop } from "../repository/userRepository.js";
import prisma from "../database/database.js";

function serializeBarber(b: any) {
  const displayName = b.users?.name ?? b.display_name;

  return {
    id: b.id,
    displayName,
    specialty: b.specialty,
    photoUrl: b.photo_url,
    commissionPercent: b.commission_percent,
    userId: b.user_id,
    barbershopId: b.barbershop_id,
    salarioFixo: b.salary,
    serviceIds: Array.isArray(b.barber_services)
      ? b.barber_services.map((item: any) => item.service_id)
      : [],
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    user: b.users
      ? {
        id: b.users.id,
        name: displayName,
        email: b.users.email,
        phone: b.users.phone,
        role: b.users.role,
        isAdmin: b.users.is_admin,
      }
      : null,
  };
}

/* ── LIST ── */
export async function listBarbersService(params: {
  barbershopId: string;
  query: { q?: string; page?: number; limit?: number };
}) {
  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 20;

  const { items, total } = await listBarbersInBarbershop({
    barbershopId: params.barbershopId,
    q: params.query.q?.trim(),
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeBarber),
  };
}

/* ── GET BY ID ── */
export async function getBarberByIdService(params: {
  barbershopId: string;
  barberId: string;
}) {
  const barber = await findBarberByIdInBarbershop(params.barbershopId, params.barberId);
  if (!barber) throw notFound("Barbeiro não encontrado");
  return serializeBarber(barber);
}

/* ── CREATE ── */
export async function createBarberService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    displayName: string;
    specialty?: string | null;
    photoUrl?: string | null;
    salarioFixo?: number | null;
    commissionPercent?: number | null;
    userId?: string | null;
    serviceIds?: string[];
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode criar barbeiros");
  }

  if (!params.data.userId) {
    throw conflict("Informe o usuario do funcionario barbeiro");
  }

  const linkedUser = await findUserByIdInBarbershop(params.barbershopId, params.data.userId);
  if (!linkedUser) throw notFound("Usuario informado nao encontrado nesta barbearia");
  if (linkedUser.role !== "barber") {
    throw conflict("O usuario informado precisa ter perfil de barbeiro");
  }

  // Se um userId foi fornecido, validar que o user existe na barbearia
  if (params.data.userId) {
    const user = await findUserByIdInBarbershop(params.barbershopId, params.data.userId);
    if (!user) throw notFound("Usuário informado não encontrado nesta barbearia");
  }

  if (Array.isArray(params.data.serviceIds) && params.data.serviceIds.length > 0) {
    const count = await prisma.services.count({
      where: {
        barbershop_id: params.barbershopId,
        id: { in: params.data.serviceIds },
      },
    });

    if (count !== params.data.serviceIds.length) {
      throw notFound("Um ou mais serviços informados não existem nesta barbearia");
    }
  }

  const barber = await createBarberInBarbershop({
    barbershopId: params.barbershopId,
    displayName: linkedUser.name.trim(),
    specialty: params.data.specialty ?? null,
    photoUrl: params.data.photoUrl ?? null,
    commissionPercent: params.data.commissionPercent ?? null,
    salarioFixo: params.data.salarioFixo ?? null,
    userId: linkedUser.id,
    serviceIds: params.data.serviceIds ?? [],
  });

  return serializeBarber(barber);
}

/* ── UPDATE ── */
export async function updateBarberService(params: {
  barbershopId: string;
  actorRole: string;
  barberId: string;
  data: {
    displayName?: string;
    specialty?: string | null;
    photoUrl?: string | null;
    commissionPercent?: number | null;
    salarioFixo?: number | null;
    serviceIds?: string[];
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode editar barbeiros");
  }

  const existing = await findBarberByIdInBarbershop(params.barbershopId, params.barberId);
  if (!existing) throw notFound("Barbeiro nÃ£o encontrado");

  const updateData: any = {};

  if (params.data.displayName !== undefined) updateData.display_name = params.data.displayName.trim();
  if (params.data.specialty !== undefined) updateData.specialty = params.data.specialty ?? null;
  if (params.data.photoUrl !== undefined) updateData.photo_url = params.data.photoUrl ?? null;
  if (params.data.commissionPercent !== undefined) updateData.commission_percent = params.data.commissionPercent ?? null;
  if (params.data.salarioFixo !== undefined) updateData.salary = params.data.salarioFixo ?? null;
  if (params.data.serviceIds !== undefined) {
    const sanitizedServiceIds = Array.isArray(params.data.serviceIds)
      ? params.data.serviceIds.map((id) => String(id))
      : [];

    if (sanitizedServiceIds.length > 0) {
      const count = await prisma.services.count({
        where: {
          barbershop_id: params.barbershopId,
          id: { in: sanitizedServiceIds },
        },
      });

      if (count !== sanitizedServiceIds.length) {
        throw notFound("Um ou mais serviços informados não existem nesta barbearia");
      }
    }

    const withServices = await replaceBarberServices(
      params.barbershopId,
      params.barberId,
      sanitizedServiceIds,
    );

    if (!withServices) throw notFound("Barbeiro não encontrado");

    if (Object.keys(updateData).length === 0) {
      return serializeBarber(withServices);
    }
  }

  if (params.data.displayName !== undefined && existing.user_id) {
    await prisma.users.update({
      where: { id: existing.user_id },
      data: { name: params.data.displayName.trim() },
    });
  }

  const updated = await updateBarberInBarbershop(params.barbershopId, params.barberId, updateData);
  if (!updated) throw notFound("Barbeiro não encontrado");

  return serializeBarber(updated);
}

/* ── LINK USER ── */
export async function linkBarberToUserService(params: {
  barbershopId: string;
  actorRole: string;
  barberId: string;
  userId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode vincular barbeiro a usuário");
  }

  // Valida que o user existe na barbearia
  const user = await findUserByIdInBarbershop(params.barbershopId, params.userId);
  if (!user) throw notFound("Usuário não encontrado nesta barbearia");

  if (user.role !== "barber") {
    throw conflict("O usuario informado precisa ter perfil de barbeiro");
  }

  const linked = await linkBarberToUser(params.barbershopId, params.barberId, params.userId);
  if (!linked) throw notFound("Barbeiro não encontrado");

  return serializeBarber(linked);
}

/* ── DELETE ── */
export async function deleteBarberService(params: {
  barbershopId: string;
  actorRole: string;
  barberId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode remover barbeiros");
  }

  const deleted = await deleteBarberFromBarbershop(params.barbershopId, params.barberId);
  if (!deleted) throw notFound("Barbeiro não encontrado");

  return { ok: true };
}

/* ── GET MY BARBER (by logged-in userId) ── */
export async function getMyBarberService(params: {
  barbershopId: string;
  userId: string;
}) {
  const barber = await findBarberByUserIdInBarbershop(params.barbershopId, params.userId);
  if (!barber) throw notFound("Perfil de barbeiro não encontrado para este usuário");
  return serializeBarber(barber);
}

/* ── SANITIZE BARBERS (Startup Routine) ── */
export async function sanitizeBarbers() {
  console.log("[Sanitization] Starting barber sanitization...");
  try {
    // 1. Get all users with role 'barber'
    const barberUsers = await prisma.users.findMany({
      where: {
        role: "barber",
        current_barbershop_id: { not: null },
      },
      include: {
        barbers: true,
      },
    });

    let createdCount = 0;
    for (const user of barberUsers) {
      if (!user.barbers) {
        // Create corresponding barber record
        await prisma.barbers.create({
          data: {
            user_id: user.id,
            display_name: user.name,
            barbershop_id: user.current_barbershop_id!,
            salary: Math.round(user.salary ?? 0),
          },
        });
        createdCount++;
        console.log(`[Sanitization] Created barber record for user: ${user.name} (${user.id})`);
      }
    }
    console.log(`[Sanitization] Sync: created ${createdCount} missing barber records.`);

    // 2. Find all barbers that are orphans (no user_id, or user does not exist, or user role is not 'barber')
    const allBarbers = await prisma.barbers.findMany({
      include: {
        users: true,
      },
    });

    let deletedCount = 0;
    for (const barber of allBarbers) {
      const isOrphan = !barber.user_id || !barber.users || barber.users.role !== "barber" || barber.users.current_barbershop_id !== barber.barbershop_id;
      if (isOrphan) {
        try {
          // Attempt to delete cascade relationships or just delete
          await prisma.barber_services.deleteMany({
            where: { barber_id: barber.id },
          });
          
          await prisma.barbers.delete({
            where: { id: barber.id },
          });
          deletedCount++;
          console.log(`[Sanitization] Deleted orphan/invalid barber record: ${barber.display_name} (${barber.id})`);
        } catch (err: any) {
          console.warn(`[Sanitization] Could not delete barber record ${barber.id} due to constraints: ${err.message}`);
        }
      }
    }
    console.log(`[Sanitization] Cleanup: deleted ${deletedCount} orphan barber records.`);
  } catch (error) {
    console.error("[Sanitization] Error during barber sanitization:", error);
  }
}
