import { getAppointmentByIdService } from "../../../../../services/appointmentService.js";
import { mapAppointmentToIntegrationDto } from "../mappers/IntegrationAppointmentMapper.js";

export interface GetAppointmentByIdInput {
  tenantId: string;
  appointmentId: string;
}

export async function GetAppointmentByIdUseCase({
  tenantId,
  appointmentId
}: GetAppointmentByIdInput) {
  const appointment = await getAppointmentByIdService({
    barbershopId: tenantId,
    appointmentId
  });

  return mapAppointmentToIntegrationDto(appointment);
}
