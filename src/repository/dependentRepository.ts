import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listDependents(params: {
  barbershopId: string;
  parentId?: string;
}) {
  const where: any = { barbershop_id: params.barbershopId };
  if (params.parentId) where.parent_id = params.parentId;

  return prisma.dependents.findMany({
    where,
    orderBy: { created_at: "asc" },
    include: {
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── FIND ALL (sem filtro de barbershop, para checagem de CPF) ───── */
export async function listAllDependentsInBarbershop(barbershopId: string) {
  return prisma.dependents.findMany({
    where: { barbershop_id: barbershopId },
  });
}

/* ───── FIND BY ID ───── */
export async function findDependentById(barbershopId: string, id: string) {
  return prisma.dependents.findFirst({
    where: { id, barbershop_id: barbershopId },
    include: {
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── CREATE ───── */
export async function createDependent(data: {
  name: string;
  age: number;
  cpf: string;
  parentId: string;
  barbershopId: string;
}) {
  return prisma.dependents.create({
    data: {
      name: data.name,
      age: data.age,
      cpf: data.cpf,
      parent_id: data.parentId,
      barbershop_id: data.barbershopId,
    },
    include: {
      users: { select: { id: true, name: true } },
    },
  });
}

/* ───── UPDATE ───── */
export async function updateDependent(
  barbershopId: string,
  id: string,
  data: { name?: string; age?: number; cpf?: string }
) {
  return prisma.dependents.updateMany({
    where: { id, barbershop_id: barbershopId },
    data,
  });
}

/* ───── DELETE ───── */
export async function deleteDependent(barbershopId: string, id: string) {
  return prisma.dependents.deleteMany({
    where: { id, barbershop_id: barbershopId },
  });
}
