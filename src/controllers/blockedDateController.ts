import { Request, Response } from "express";
import {
  BlockedDateIdParamSchema,
  CreateBlockedDateSchema,
  ListBlockedDatesQuerySchema,
  UpdateBlockedDateSchema,
} from "../models/blockedDateSchemas.js";
import {
  checkBlockedDateService,
  createBlockedDateService,
  deleteBlockedDateService,
  listBlockedDatesService,
  updateBlockedDateService,
} from "../services/blockedDateService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST (com filtro opcional por date, dateFrom, dateTo, barberId) ───── */
export async function listBlockedDates(req: Request, res: Response) {
  const { error, value } = ListBlockedDatesQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  // Se query param `date` presente, retorna check de data específica
  if (value.date) {
    const result = await checkBlockedDateService({
      barbershopId: req.user!.barbershopId,
      date: value.date,
      barberId: value.barberId,
    });
    return res.status(200).send(result);
  }

  const result = await listBlockedDatesService({
    barbershopId: req.user!.barbershopId,
    query: {
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
      barberId: value.barberId,
    },
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createBlockedDate(req: Request, res: Response) {
  const { error, value } = CreateBlockedDateSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createBlockedDateService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── DELETE ───── */
export async function updateBlockedDate(req: Request, res: Response) {
  const params = BlockedDateIdParamSchema.validate(req.params);
  if (params.error) return res.status(422).send(joiErrors(params.error));

  const body = UpdateBlockedDateSchema.validate(req.body);
  if (body.error) return res.status(422).send(joiErrors(body.error));

  const result = await updateBlockedDateService({
    barbershopId: req.user!.barbershopId,
    blockedDateId: req.params.id,
    data: body.value,
  });

  return res.status(200).send(result);
}

export async function deleteBlockedDate(req: Request, res: Response) {
  const { error } = BlockedDateIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteBlockedDateService({
    barbershopId: req.user!.barbershopId,
    blockedDateId: req.params.id,
  });

  return res.status(200).send(result);
}
