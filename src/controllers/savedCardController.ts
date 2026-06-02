import { Request, Response } from "express";
import {
  CreateSavedCardSchema,
  SavedCardIdParamSchema,
  SetMainCardSchema,
  ListSavedCardsQuerySchema,
} from "../models/savedCardSchemas.js";
import {
  createSavedCardService,
  deleteSavedCardService,
  listSavedCardsService,
  setMainCardService,
} from "../services/savedCardService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listSavedCards(req: Request, res: Response) {
  const { error, value } = ListSavedCardsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listSavedCardsService({
    barbershopId: req.user!.barbershopId,
    userId: value.userId,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createSavedCard(req: Request, res: Response) {
  const { error, value } = CreateSavedCardSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createSavedCardService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── SET MAIN ───── */
export async function patchSavedCard(req: Request, res: Response) {
  const { error: paramError } = SavedCardIdParamSchema.validate(req.params);
  if (paramError) return res.status(422).send(joiErrors(paramError));

  const { error, value } = SetMainCardSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await setMainCardService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    cardId: req.params.id,
    isMain: value.isMain,
  });

  return res.status(200).send(result);
}

/* ───── DELETE ───── */
export async function deleteSavedCard(req: Request, res: Response) {
  const { error } = SavedCardIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteSavedCardService({
    barbershopId: req.user!.barbershopId,
    cardId: req.params.id,
  });

  return res.status(200).send(result);
}
