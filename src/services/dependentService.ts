import { badRequest, notFound, conflict } from "../errors/index.js";
import {
  createDependent,
  deleteDependent,
  findDependentById,
  listAllDependentsInBarbershop,
  listDependents,
  updateDependent,
} from "../repository/dependentRepository.js";
import { findUserByCpf } from "../repository/authRepository.js";

const MAX_DEPENDENTS = 5;

/* ─────────────── helpers ─────────────── */
function serialize(dep: any) {
  return {
    id: dep.id,
    name: dep.name,
    age: dep.age,
    cpf: dep.cpf,
    parentId: dep.parent_id,
    parentName: dep.users?.name ?? null,
    barbershopId: dep.barbershop_id,
    createdAt: dep.created_at,
    updatedAt: dep.updated_at,
  };
}

function normalizeCpf(cpf: string) {
  return cpf.replace(/[^0-9]/g, "");
}

/* ───────── LIST ───────── */
export async function listDependentsService(params: {
  barbershopId: string;
  parentId?: string;
}) {
  const items = await listDependents({
    barbershopId: params.barbershopId,
    parentId: params.parentId,
  });
  return items.map(serialize);
}

/* ───────── CREATE ───────── */
export async function createDependentService(params: {
  barbershopId: string;
  actorId: string;
  data: { name: string; age: number; cpf: string };
}) {
  const cpf = normalizeCpf(params.data.cpf);

  const existing = await listDependents({
    barbershopId: params.barbershopId,
    parentId: params.actorId,
  });
  if (existing.length >= MAX_DEPENDENTS) {
    throw badRequest(`Limite de ${MAX_DEPENDENTS} dependentes atingido`);
  }

  const allDeps = await listAllDependentsInBarbershop(params.barbershopId);
  const cpfExists = allDeps.some((d) => normalizeCpf(d.cpf) === cpf);
  if (cpfExists) {
    throw conflict("Este CPF já está cadastrado como dependente");
  }

  const existingCpf = await findUserByCpf(cpf);
  if (existingCpf) throw conflict("CPF já cadastrado como usuário");

  const created = await createDependent({
    name: params.data.name,
    age: params.data.age,
    cpf,
    parentId: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}

/* ───────── UPDATE ───────── */
export async function updateDependentService(params: {
  barbershopId: string;
  dependentId: string;
  data: { name?: string; age?: number; cpf?: string };
}) {
  const existing = await findDependentById(params.barbershopId, params.dependentId);
  if (!existing) throw notFound("Dependente não encontrado");

  const updateData: any = {};
  if (params.data.name !== undefined) updateData.name = params.data.name;
  if (params.data.age !== undefined) updateData.age = params.data.age;
  if (params.data.cpf !== undefined) {
    const cpf = normalizeCpf(params.data.cpf);
    // Verificar CPF duplicado (excluindo o próprio)
    const allDeps = await listAllDependentsInBarbershop(params.barbershopId);
    const cpfExists = allDeps.some(
      (d) => normalizeCpf(d.cpf) === cpf && d.id !== params.dependentId
    );
    if (cpfExists) {
      throw conflict("Este CPF já está cadastrado como dependente");
    }
    updateData.cpf = cpf;
  }

  await updateDependent(params.barbershopId, params.dependentId, updateData);

  const updated = await findDependentById(params.barbershopId, params.dependentId);
  return serialize(updated);
}

/* ───────── DELETE ───────── */
export async function deleteDependentService(params: {
  barbershopId: string;
  dependentId: string;
}) {
  const existing = await findDependentById(params.barbershopId, params.dependentId);
  if (!existing) throw notFound("Dependente não encontrado");

  await deleteDependent(params.barbershopId, params.dependentId);
  return { message: "Dependente removido com sucesso" };
}
