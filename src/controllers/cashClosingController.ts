import { Request, Response } from "express";
import {
  CashClosingIdParamSchema,
  CashClosingPreviewQuerySchema,
  CreateCashClosingSchema,
  ListCashClosingsQuerySchema,
} from "../models/cashClosingSchemas.js";
import {
  createCashClosingService,
  getCashClosingPreviewService,
  getCashClosingReportService,
  listCashClosingsService,
} from "../services/cashClosingService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados invalidos"];
}

export async function listCashClosings(req: Request, res: Response) {
  const { error, value } = ListCashClosingsQuerySchema.validate(req.query);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listCashClosingsService({
    barbershopId: req.user!.barbershopId,
    date: value.date,
  });

  return res.status(200).send(result);
}

export async function getCashClosingPreview(req: Request, res: Response) {
  const { error, value } = CashClosingPreviewQuerySchema.validate(req.query);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getCashClosingPreviewService({
    barbershopId: req.user!.barbershopId,
    date: value.date,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
  });

  return res.status(200).send(result);
}

export async function createCashClosing(req: Request, res: Response) {
  const { error, value } = CreateCashClosingSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createCashClosingService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(201).send(result);
}

export async function getCashClosingReport(req: Request, res: Response) {
  const { error } = CashClosingIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getCashClosingReportService({
    barbershopId: req.user!.barbershopId,
    closingId: req.params.id,
  });

  return res.status(200).send(result);
}
