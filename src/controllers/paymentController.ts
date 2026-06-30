import { Request, Response } from "express";
import {
  CreateAppointmentPaymentSchema,
  CreateCashOutSchema,
  CreateExtraPaymentSchema,
  CreateManualSubscriptionPaymentSchema,
  CreatePaymentSchema,
  ListAppointmentPaymentsQuerySchema,
  ListExtraPaymentsQuerySchema,
  ListPaymentsQuerySchema,
  PaymentIdParamSchema,
  UpdatePaymentSchema,
} from "../models/paymentSchemas.js";
import {
  createAppointmentPaymentService,
  createCashOutService,
  createExtraPaymentService,
  createManualSubscriptionPaymentService,
  createPaymentService,
  deleteExtraPaymentService,
  getPaymentByIdService,
  listAllPaymentsService,
  listAppointmentPaymentsService,
  listExtraPaymentsService,
  listPaymentsService,
  updatePaymentService,
} from "../services/paymentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ═══════════ PAYMENTS (subscription) ═══════════ */

export async function listPayments(req: Request, res: Response) {
  const { error, value } = ListPaymentsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      userId: value.userId,
      subscriptionId: value.subscriptionId,
      status: value.status,
      method: value.method,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function listAllPayments(req: Request, res: Response) {
  const { error, value } = ListPaymentsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listAllPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      userId: value.userId,
      status: value.status,
      method: value.method,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function getPaymentById(req: Request, res: Response) {
  const { error } = PaymentIdParamSchema.validate(req.params);

  if (error) return res.status(422).send(joiErrors(error));

  const result = await getPaymentByIdService({
    barbershopId: req.user!.barbershopId,
    paymentId: req.params.id,
  });

  return res.status(200).send(result);
}

export async function createPayment(req: Request, res: Response) {
  const { error, value } = CreatePaymentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createPaymentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

export async function createManualSubscriptionPayment(req: Request, res: Response) {
  const { error, value } = CreateManualSubscriptionPaymentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createManualSubscriptionPaymentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

export async function createCashOut(req: Request, res: Response) {
  const { error, value } = CreateCashOutSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createCashOutService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ═══════════ APPOINTMENT PAYMENTS ═══════════ */

export async function listAppointmentPayments(req: Request, res: Response) {
  const { error, value } = ListAppointmentPaymentsQuerySchema.validate(
    req.query,
    { abortEarly: false }
  );

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listAppointmentPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      appointmentId: value.appointmentId,
      userId: value.userId,
      status: value.status,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function createAppointmentPayment(req: Request, res: Response) {
  const { error, value } = CreateAppointmentPaymentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createAppointmentPaymentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ═══════════ EXTRA PAYMENTS ═══════════ */

export async function listExtraPayments(req: Request, res: Response) {
  const { error, value } = ListExtraPaymentsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listExtraPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    query: {
      userId: value.userId,
      status: value.status,
      method: value.method,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function createExtraPayment(req: Request, res: Response) {
  const { error, value } = CreateExtraPaymentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createExtraPaymentService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    data: value,
  });

  return res.status(201).send(result);
}

export async function deleteExtraPayment(req: Request, res: Response) {
  const { error } = PaymentIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteExtraPaymentService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    paymentId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ═══════════ UPDATE (shared) ═══════════ */

export async function updatePayment(req: Request, res: Response) {
  const { error: paramError } = PaymentIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (paramError) return res.status(422).send(joiErrors(paramError));

  const { error: bodyError, value } = UpdatePaymentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (bodyError) return res.status(422).send(joiErrors(bodyError));

  const result = await updatePaymentService({
    barbershopId: req.user!.barbershopId,
    paymentId: req.params.id,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(200).send(result);
}
