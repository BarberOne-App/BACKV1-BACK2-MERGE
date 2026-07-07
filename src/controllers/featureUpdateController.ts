import { Request, Response } from "express";
import {
  SuperAdminFeatureUpdateIdParamSchema,
  SuperAdminFeatureUpdateSchema,
} from "../models/superAdminSchemas.js";
import {
  createFeatureUpdateService,
  deleteFeatureUpdateService,
  listFeatureUpdatesService,
  updateFeatureUpdateService,
} from "../services/featureUpdateService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados invalidos"];
}

export async function listActiveFeatureUpdates(_req: Request, res: Response) {
  const result = await listFeatureUpdatesService({ activeOnly: true });
  return res.status(200).send(result);
}

export async function listSuperAdminFeatureUpdates(_req: Request, res: Response) {
  const result = await listFeatureUpdatesService();
  return res.status(200).send(result);
}

export async function createSuperAdminFeatureUpdate(req: Request, res: Response) {
  const { error, value } = SuperAdminFeatureUpdateSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await createFeatureUpdateService({
    title: value.title,
    description: value.description,
    active: value.active,
  });

  return res.status(201).send(result);
}

export async function updateSuperAdminFeatureUpdate(req: Request, res: Response) {
  const p = SuperAdminFeatureUpdateIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = SuperAdminFeatureUpdateSchema.validate(req.body, {
    abortEarly: false,
  });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updateFeatureUpdateService(req.params.id, {
    title: b.value.title,
    description: b.value.description,
    active: b.value.active,
  });

  return res.status(200).send(result);
}

export async function deleteSuperAdminFeatureUpdate(req: Request, res: Response) {
  const { error } = SuperAdminFeatureUpdateIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  await deleteFeatureUpdateService(req.params.id);
  return res.status(204).send();
}
