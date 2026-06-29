const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatLocalTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function mapAppointmentToIntegrationDto(appointment: {
  id: string;
  status: string;
  clientId: string;
  barberId: string;
  dependentId?: string | null;
  startAt: Date | string;
  endAt: Date | string;
  notes?: string | null;
  services?: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    unitPrice: number;
    durationMinutes: number;
    quantity: number;
  }>;
  totalAmount?: number;
}) {
  const startAt = new Date(appointment.startAt);
  const endAt = new Date(appointment.endAt);

  return {
    id: appointment.id,
    status: appointment.status,
    customerId: appointment.clientId,
    professionalId: appointment.barberId,
    dependentId: appointment.dependentId ?? null,
    date: Number.isNaN(startAt.getTime())
      ? null
      : formatLocalDate(startAt),
    time: Number.isNaN(startAt.getTime())
      ? null
      : formatLocalTime(startAt),
    startAt,
    endAt,
    notes: appointment.notes ?? null,
    services:
      appointment.services?.map(service => ({
        id: service.serviceId,
        appointmentServiceId: service.id,
        name: service.serviceName,
        unitPrice: service.unitPrice,
        durationMinutes: service.durationMinutes,
        quantity: service.quantity
      })) ?? [],
    totalAmount: appointment.totalAmount ?? 0
  };
}
