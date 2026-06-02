import { notFound } from "../errors/index.js";
import {
  createEmployeeVale,
  deleteEmployeeVale,
  findEmployeeValeById,
  listEmployeeVales,
} from "../repository/employeeValeRepository.js";

/* ─────────────── helpers ─────────────── */
function serialize(vale: any) {
  const note = String(vale.note ?? "");
  const [descriptionLine, ...observationLines] = note.split("\n\n");
  const description = descriptionLine.replace(/^Motivo:\s*/i, "") || null;
  const observation = observationLines.join("\n\n").replace(/^Observacao:\s*/i, "") || null;

  return {
    id: vale.id,
    employeeId: vale.employee_id,
    employeeName: vale.employee?.name ?? null,
    valor: Number(vale.amount),
    descricao: description,
    motivo: description,
    observacao: observation,
    note: vale.note,
    data: typeof vale.date === "string" ? vale.date : (vale.date as Date).toISOString().slice(0, 10),
    createdAt: vale.created_at,
    createdBy: vale.created_by,
    createdByName: vale.creator?.name ?? null,
  };
}

/* ───────── LIST ───────── */
export async function listEmployeeValesService(barbershopId: string) {
  const items = await listEmployeeVales(barbershopId);
  return items.map(serialize);
}

/* ───────── CREATE ───────── */
export async function createEmployeeValeService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    employeeId: string;
    valor: number;
    descricao?: string | null;
    motivo?: string | null;
    observacao?: string | null;
    data: string;
  };
}) {
  const dateObj = new Date(params.data.data + "T00:00:00Z");
  const description = (params.data.descricao ?? params.data.motivo ?? "").trim();
  const observation = (params.data.observacao ?? "").trim();
  const note = [
    description ? `Motivo: ${description}` : null,
    observation ? `Observacao: ${observation}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const created = await createEmployeeVale({
    employeeId: params.data.employeeId,
    amount: params.data.valor,
    note: note || null,
    date: dateObj,
    createdBy: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}

/* ───────── DELETE ───────── */
export async function deleteEmployeeValeService(params: {
  barbershopId: string;
  valeId: string;
}) {
  const existing = await findEmployeeValeById(params.barbershopId, params.valeId);
  if (!existing) throw notFound("Vale não encontrado");

  await deleteEmployeeVale(params.barbershopId, params.valeId);
  return { message: "Vale excluído com sucesso" };
}
