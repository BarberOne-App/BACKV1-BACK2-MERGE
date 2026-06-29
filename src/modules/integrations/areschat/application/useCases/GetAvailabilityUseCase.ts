import { badRequest } from "../../../../../errors/index.js";
import { getAvailableSlotsService } from "../../../../../services/appointmentService.js";
import { findServiceById } from "../../../../../repository/serviceRepository.js";
import { mapAvailabilityToIntegrationDto } from "../mappers/IntegrationAvailabilityMapper.js";

export interface GetAvailabilityInput {
  tenantId: string;
  professionalId: string;
  date: string;
  serviceId?: string;
  durationMinutes?: number;
}

export async function GetAvailabilityUseCase({
  tenantId,
  professionalId,
  date,
  serviceId,
  durationMinutes
}: GetAvailabilityInput) {
  let resolvedDuration = Number(durationMinutes || 0);

  if (!resolvedDuration && serviceId) {
    const service = await findServiceById(tenantId, serviceId);
    if (!service) {
      throw badRequest("Servico nao encontrado");
    }

    resolvedDuration = Number(service.duration_minutes || 0);
  }

  if (!resolvedDuration || !Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
    throw badRequest(
      "Informe serviceId ou durationMinutes para consultar disponibilidade"
    );
  }

  const slots = await getAvailableSlotsService({
    barbershopId: tenantId,
    barberId: professionalId,
    date,
    duration: resolvedDuration
  });

  return mapAvailabilityToIntegrationDto({
    date,
    professionalId,
    slots
  });
}
