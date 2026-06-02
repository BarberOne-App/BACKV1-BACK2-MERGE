import { forbidden } from "../errors/index.js";
import {
  createService,
  findServiceById,
  listServices,
  reactivateService,
  softDeleteService,
  updateService,
} from "../repository/serviceRepository.js";

function decimalToNumber(v: any) {
  if (v == null) return v;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v?.toNumber === "function") return v.toNumber();
  return Number(v);
}

function serializeService(s: any) {
  return {
    id: s.id,
    name: s.name,
    basePrice: decimalToNumber(s.base_price),
    durationMinutes: s.duration_minutes,
    commissionPercent: decimalToNumber(s.comission_percent),
    comissionPercent: decimalToNumber(s.comission_percent),
    commission_percent: decimalToNumber(s.comission_percent),
    promotionalPrice: decimalToNumber(s.promotional_price),
    covered_by_plan: s.covered_by_plan,
    imageUrl: s.image_url,
    active: s.active,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    barbershopId: s.barbershop_id,
  };
}

export async function createServiceService(
  barbershopId: string,
  data: {
    name: string;
    basePrice: number;
    durationMinutes: number;
    comissionPercent?: number | null;
    promotionalPrice?: number;
    covered_by_plan?: boolean;
    imageUrl?: string | null;
    active?: boolean;
  }
) {
  const created = await createService({
    barbershopId,
    name: data.name,
    base_price: data.basePrice,
    duration_minutes: data.durationMinutes,
    comission_percent: data.comissionPercent ?? null,
    promotional_price: data.promotionalPrice ?? 0,
    covered_by_plan: data.covered_by_plan ?? false,
    image_url: data.imageUrl ?? null,
    active: data.active ?? true,
  });

  return serializeService(created);
}

export async function importServicesService(params: {
  barbershopId: string;
  actorRole: string;
  rows: Array<{
    name: string;
    basePrice: number;
    durationMinutes: number;
    commissionPercent?: number | null;
    comissionPercent?: number | null;
    promotionalPrice?: number;
    covered_by_plan?: boolean;
    imageUrl?: string | null;
    active?: boolean;
  }>;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode importar serviços");
  }

  const created: any[] = [];
  const errors: Array<{ row: number; name?: string; message: string }> = [];

  for (let i = 0; i < params.rows.length; i += 1) {
    const rowIndex = i + 1;
    const row = params.rows[i];

    try {
      const service = await createServiceService(params.barbershopId, {
        name: row.name,
        basePrice: row.basePrice,
        durationMinutes: row.durationMinutes,
        comissionPercent: row.comissionPercent ?? row.commissionPercent ?? null,
        promotionalPrice: row.promotionalPrice ?? 0,
        covered_by_plan: row.covered_by_plan ?? false,
        imageUrl: row.imageUrl ?? null,
        active: row.active ?? true,
      });
      created.push(service);
    } catch (error: any) {
      errors.push({
        row: rowIndex,
        name: row.name,
        message: error?.message || "Erro ao criar serviço",
      });
    }
  }

  return {
    createdCount: created.length,
    failedCount: errors.length,
    created,
    errors,
  };
}

export async function listServicesService(params: {
  barbershopId: string;
  isAdmin: boolean;
  q?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const includeInactive = params.isAdmin ? !!params.includeInactive : false;

  const { items, total } = await listServices({
    barbershopId: params.barbershopId,
    q: params.q?.trim() || undefined,
    includeInactive,
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeService),
  };
}

export async function getServiceByIdService(params: {
  barbershopId: string;
  id: string;
  isAdmin: boolean;
}) {
  const s = await findServiceById(params.barbershopId, params.id);
  if (!s) return null;

  if (!params.isAdmin && !s.active) return null;

  return serializeService(s);
}

export async function updateServiceService(params: {
  barbershopId: string;
  id: string;
  data: {
    name?: string;
    basePrice?: number;
    durationMinutes?: number;
    comissionPercent?: number | null;
    promotionalPrice?: number;
    covered_by_plan?: boolean;
    imageUrl?: string | null;
    active?: boolean;
  };
}) {
  const updated = await updateService(params.barbershopId, params.id, {
    ...(params.data.name != null ? { name: params.data.name } : {}),
    ...(params.data.basePrice != null
      ? { base_price: params.data.basePrice }
      : {}),
    ...(params.data.durationMinutes != null
      ? { duration_minutes: params.data.durationMinutes }
      : {}),
    ...(params.data.comissionPercent != null
      ? { comission_percent: params.data.comissionPercent }
      : {}),
    ...(params.data.promotionalPrice != null
      ? { promotional_price: params.data.promotionalPrice }
      : {}),
    ...(params.data.covered_by_plan != null
      ? { covered_by_plan: params.data.covered_by_plan }
      : {}),
    ...(params.data.imageUrl !== undefined
      ? { image_url: params.data.imageUrl }
      : {}),
    ...(params.data.active != null ? { active: params.data.active } : {}),
  });

  if (!updated) return null;
  return serializeService(updated);
}

export async function deleteServiceService(barbershopId: string, id: string) {
  const result = await softDeleteService(barbershopId, id);
  if (!result) return null;

  return {
    service: serializeService(result.service),
    deletedHard: false,
    reason: "Serviço desativado com sucesso",
  };
}

export async function reactivateServiceService(
  barbershopId: string,
  id: string
) {
  const reactivated = await reactivateService(barbershopId, id);
  if (!reactivated) return null;

  return {
    service: serializeService(reactivated),
    reason: "Serviço reativado com sucesso",
  };
}
