import { Request, Response } from "express";
import {
  CreatePaymentMethodSchema,
  ListPaymentMethodsQuerySchema,
  PaymentMethodIdParamSchema,
} from "../models/paymentMethodSchemas.js";
import {
  createPaymentMethodService,
  deletePaymentMethodService,
  listPaymentMethodsService,
  setDefaultPaymentMethodService,
} from "../services/paymentMethodService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listPaymentMethods(req: Request, res: Response) {
  const { error, value } = ListPaymentMethodsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  // Clientes só veem os próprios
  const userId = req.user!.role === "client" ? req.user!.id : value.userId;

  const result = await listPaymentMethodsService({
    barbershopId: req.user!.barbershopId,
    userId,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createPaymentMethod(req: Request, res: Response) {
  const { error, value } = CreatePaymentMethodSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createPaymentMethodService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── SET DEFAULT ───── */
export async function setDefaultPaymentMethod(req: Request, res: Response) {
  const { error } = PaymentMethodIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  // Buscar o payment method para pegar o userId
  const result = await setDefaultPaymentMethodService({
    barbershopId: req.user!.barbershopId,
    paymentMethodId: req.params.id,
    userId: req.user!.id,
  });

  return res.status(200).send(result);
}

/* ───── DELETE ───── */
export async function deletePaymentMethod(req: Request, res: Response) {
  const { error } = PaymentMethodIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deletePaymentMethodService({
    barbershopId: req.user!.barbershopId,
    paymentMethodId: req.params.id,
  });

  return res.status(200).send(result);
}
