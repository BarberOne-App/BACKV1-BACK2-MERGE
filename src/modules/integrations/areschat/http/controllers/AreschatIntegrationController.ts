import { Request, Response } from "express";
import {
  AppointmentIdParamSchema,
  AvailabilityQuerySchema,
  CreateAppointmentBodySchema,
  CreateCustomerBodySchema,
  EligibilityBodySchema,
  ListProfessionalsQuerySchema,
  ListServicesQuerySchema
} from "../dtos/areschatIntegrationSchemas.js";
import { HealthCheckUseCase } from "../../application/useCases/HealthCheckUseCase.js";
import { ListServicesUseCase } from "../../application/useCases/ListServicesUseCase.js";
import { ListProfessionalsUseCase } from "../../application/useCases/ListProfessionalsUseCase.js";
import { CheckCustomerEligibilityUseCase } from "../../application/useCases/CheckCustomerEligibilityUseCase.js";
import { ListPlansUseCase } from "../../application/useCases/ListPlansUseCase.js";
import { ListPaymentMethodsUseCase } from "../../application/useCases/ListPaymentMethodsUseCase.js";
import { GetAvailabilityUseCase } from "../../application/useCases/GetAvailabilityUseCase.js";
import { CreateCustomerUseCase } from "../../application/useCases/CreateCustomerUseCase.js";
import { CreateAppointmentUseCase } from "../../application/useCases/CreateAppointmentUseCase.js";
import { GetAppointmentByIdUseCase } from "../../application/useCases/GetAppointmentByIdUseCase.js";
import { CancelAppointmentUseCase } from "../../application/useCases/CancelAppointmentUseCase.js";
import { badRequest } from "../../../../../errors/index.js";

const formatJoiErrors = (error: any) =>
  error.details?.map((detail: any) => detail.message) ?? ["Dados invalidos"];

export async function health(_req: Request, res: Response) {
  return res.status(200).json(HealthCheckUseCase());
}

export async function listServices(req: Request, res: Response) {
  const { error, value } = ListServicesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const items = await ListServicesUseCase({
    tenantId: req.integration!.tenantId,
    q: value.q
  });

  return res.status(200).json(items);
}

export async function listProfessionals(req: Request, res: Response) {
  const { error, value } = ListProfessionalsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const items = await ListProfessionalsUseCase({
    tenantId: req.integration!.tenantId,
    q: value.q,
    serviceId: value.serviceId,
    customerId: value.customerId
  });

  return res.status(200).json(items);
}

export async function listPlans(req: Request, res: Response) {
  const items = await ListPlansUseCase({
    tenantId: req.integration!.tenantId
  });

  return res.status(200).json(items);
}

export async function listPaymentMethods(req: Request, res: Response) {
  const items = await ListPaymentMethodsUseCase({
    tenantId: req.integration!.tenantId
  });

  return res.status(200).json(items);
}

export async function getAvailability(req: Request, res: Response) {
  const { error, value } = AvailabilityQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await GetAvailabilityUseCase({
    tenantId: req.integration!.tenantId,
    professionalId: value.professionalId,
    date: value.date,
    serviceId: value.serviceId,
    durationMinutes: value.durationMinutes
  });

  return res.status(200).json(result);
}

export async function checkEligibility(req: Request, res: Response) {
  const { error, value } = EligibilityBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await CheckCustomerEligibilityUseCase({
    tenantId: req.integration!.tenantId,
    identifierType: value.identifierType,
    identifierValue: value.identifierValue
  });

  return res.status(200).json(result);
}

export async function createCustomer(req: Request, res: Response) {
  const { error, value } = CreateCustomerBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await CreateCustomerUseCase({
    tenantId: req.integration!.tenantId,
    name: value.name,
    phone: value.phone,
    email: value.email,
    document: value.document
  });

  return res.status(200).json(result);
}

export async function createAppointment(req: Request, res: Response) {
  const { error, value } = CreateAppointmentBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await CreateAppointmentUseCase({
    tenantId: req.integration!.tenantId,
    customerId: value.customerId,
    professionalId: value.professionalId,
    dependentId: value.dependentId,
    date: value.date,
    time: value.time,
    notes: value.notes,
    paymentMethodId: value.paymentMethodId,
    paymentMethod: value.paymentMethod,
    serviceId: value.serviceId,
    serviceIds: value.serviceIds
  });

  return res.status(201).json(result);
}

export async function getAppointmentById(req: Request, res: Response) {
  const { error, value } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await GetAppointmentByIdUseCase({
    tenantId: req.integration!.tenantId,
    appointmentId: value.id
  });

  return res.status(200).json(result);
}

export async function cancelAppointment(req: Request, res: Response) {
  const { error, value } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    throw badRequest(formatJoiErrors(error).join("; "));
  }

  const result = await CancelAppointmentUseCase({
    tenantId: req.integration!.tenantId,
    appointmentId: value.id
  });

  return res.status(200).json(result);
}
