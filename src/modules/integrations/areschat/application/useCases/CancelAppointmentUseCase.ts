import { cancelAppointmentService } from "../../../../../services/appointmentService.js";
import { mapAppointmentToIntegrationDto } from "../mappers/IntegrationAppointmentMapper.js";

export interface CancelAppointmentInput {
  tenantId: string;
  appointmentId: string;
}

export async function CancelAppointmentUseCase({
  tenantId,
  appointmentId
}: CancelAppointmentInput) {
  const appointment = await cancelAppointmentService({
    barbershopId: tenantId,
    appointmentId,
    actorRole: "admin",
    actorIsAdmin: true,
    actorId: "areschat-integration"
  });

  return mapAppointmentToIntegrationDto(appointment);
}
