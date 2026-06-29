import { notFound } from "../../../../../errors/index.js";
import { createAppointmentService } from "../../../../../services/appointmentService.js";
import { findBarberByIdInBarbershop } from "../../../../../repository/barberRepository.js";
import { mapAppointmentToIntegrationDto } from "../mappers/IntegrationAppointmentMapper.js";
import { findUserByIdInBarbershop } from "../../infra/repositories/IntegrationCustomerRepository.js";

export interface CreateAppointmentInput {
  tenantId: string;
  customerId: string;
  professionalId: string;
  date: string;
  time: string;
  notes?: string | null;
  paymentMethodId?: string | null;
  paymentMethod?: string | null;
  dependentId?: string | null;
  serviceId?: string;
  serviceIds?: string[];
}

function normalizeServiceIds(input: {
  serviceId?: string;
  serviceIds?: string[];
}) {
  const serviceIds = input.serviceIds?.filter(Boolean) ?? [];

  if (input.serviceId) {
    return [input.serviceId];
  }

  return serviceIds;
}

function appendPaymentMethodToNotes(input: {
  notes?: string | null;
  paymentMethodId?: string | null;
  paymentMethod?: string | null;
}) {
  const paymentMethod = String(input.paymentMethod || input.paymentMethodId || "").trim();
  const notes = String(input.notes || "").trim();

  if (!paymentMethod) {
    return notes || null;
  }

  return [notes, `[areschat:payment_method=${paymentMethod}]`]
    .filter(Boolean)
    .join("\n");
}

export async function CreateAppointmentUseCase(input: CreateAppointmentInput) {
  const customer = await findUserByIdInBarbershop(
    input.tenantId,
    input.customerId
  );

  if (!customer) {
    throw notFound("Cliente nao encontrado na barbearia");
  }

  const professional = await findBarberByIdInBarbershop(
    input.tenantId,
    input.professionalId
  );

  if (!professional) {
    throw notFound("Profissional nao encontrado na barbearia");
  }

  const serviceIds = normalizeServiceIds({
    serviceId: input.serviceId,
    serviceIds: input.serviceIds
  });

  const appointment = await createAppointmentService({
    barbershopId: input.tenantId,
    data: {
      barberId: input.professionalId,
      clientId: input.customerId,
      dependentId: input.dependentId ?? null,
      date: input.date,
      time: input.time,
      notes: appendPaymentMethodToNotes(input),
      services: serviceIds.map(id => ({
        id
      })),
      products: []
    }
  });

  return mapAppointmentToIntegrationDto(appointment);
}
