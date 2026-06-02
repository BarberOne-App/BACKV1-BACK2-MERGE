import { Request, Response } from "express";
import {
  AppointmentIdParamSchema,
  AvailableSlotsQuerySchema,
  CreateAppointmentSchema,
  ListAppointmentsQuerySchema,
  UpdateAppointmentSchema,
} from "../models/appointmentSchemas.js";
import {
  cancelAppointmentService,
  createAppointmentService,
  getAppointmentByIdService,
  getAvailableSlotsService,
  listAppointmentsService,
  updateAppointmentService,
} from "../services/appointmentService.js";
import { sendAppointmentConfirmedEmail } from "../services/emailService.js";

const APPOINTMENT_CONFIRMATION_TEST_EMAIL = "rodolphopbuettel@outlook.com";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listAppointments(req: Request, res: Response) {
  const { error, value } = ListAppointmentsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await listAppointmentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    actorPermissions: req.user!.permissions,
    query: {
      barberId: value.barberId,
      clientId: value.clientId,
      status: value.status,
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
      page: value.page,
      limit: value.limit,
      allAppointments: value.allAppointments,
    },
  });

  return res.status(200).send(result);
}

/* ───── GET BY ID ───── */
export async function getAppointmentById(req: Request, res: Response) {
  const { error, value } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await getAppointmentByIdService({
    barbershopId: req.user!.barbershopId,
    appointmentId: value.id,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createAppointment(req: Request, res: Response) {
  const { error, value } = CreateAppointmentSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await createAppointmentService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorId: req.user!.id,
    actorPermissions: req.user!.permissions,
    data: {
      barberId: value.barberId,
      clientId: value.clientId,
      dependentId: value.dependentId ?? null,
      date: value.date,
      time: value.time,
      notes: value.notes ?? null,
      allowOutsideBusinessHours: value.allowOutsideBusinessHours === true,
      services: value.services ?? [],
      products: value.products ?? [],
    },
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updateAppointment(req: Request, res: Response) {
  const paramsValidation = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (paramsValidation.error) {
    return res.status(422).send(joiErrors(paramsValidation.error));
  }

  const bodyValidation = UpdateAppointmentSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (bodyValidation.error) {
    return res.status(422).send(joiErrors(bodyValidation.error));
  }

  const result = await updateAppointmentService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorId: req.user!.id,
    actorPermissions: req.user!.permissions,
    appointmentId: paramsValidation.value.id,
    data: {
      status: bodyValidation.value.status,
      notes: bodyValidation.value.notes,
      barberId: bodyValidation.value.barberId,
    },
  });

  return res.status(200).send(result);
}

/* ───── CANCEL (soft delete) ───── */
export async function deleteAppointment(req: Request, res: Response) {
  const { error, value } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await cancelAppointmentService({
    barbershopId: req.user!.barbershopId,
    appointmentId: value.id,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorId: req.user!.id,
    actorPermissions: req.user!.permissions,
  });

  return res.status(200).send(result);
}

/* ───── AVAILABLE SLOTS ───── */
export async function getAvailableSlots(req: Request, res: Response) {
  const { error, value } = AvailableSlotsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const slots = await getAvailableSlotsService({
    barbershopId: req.user!.barbershopId,
    barberId: value.barberId,
    date: value.date,
    duration: value.duration,
  });

  return res.status(200).send({ slots });
}

/* ───── TEST E-MAIL ───── */
export async function sendAppointmentEmailTest(_req: Request, res: Response) {
  try {
    await sendAppointmentConfirmedEmail({
      to: APPOINTMENT_CONFIRMATION_TEST_EMAIL,
      clientName: "Teste Backend",
      barberName: "BarberOne",
      startAt: new Date(),
      serviceNames: ["Corte de cabelo"],
    });

    return res.status(200).send({
      ok: true,
      message: `E-mail de teste enviado para ${APPOINTMENT_CONFIRMATION_TEST_EMAIL}`,
      to: APPOINTMENT_CONFIRMATION_TEST_EMAIL,
    });
  } catch (error: any) {
    return res.status(500).send({
      ok: false,
      message: "Falha ao enviar e-mail de teste",
      error: error?.message || "Erro desconhecido",
    });
  }
}
