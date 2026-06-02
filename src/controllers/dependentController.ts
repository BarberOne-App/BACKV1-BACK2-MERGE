import { Request, Response } from "express";
import {
  CreateDependentSchema,
  UpdateDependentSchema,
  DependentIdParamSchema,
  ListDependentsQuerySchema,
} from "../models/dependentSchemas.js";
import {
  createDependentService,
  deleteDependentService,
  listDependentsService,
  updateDependentService,
} from "../services/dependentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listDependents(req: Request, res: Response) {
  const { error, value } = ListDependentsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listDependentsService({
    barbershopId: req.user!.barbershopId,
    parentId: value.parentId,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createDependent(req: Request, res: Response) {
  const { error, value } = CreateDependentSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createDependentService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updateDependent(req: Request, res: Response) {
  const { error: paramError } = DependentIdParamSchema.validate(req.params);
  if (paramError) return res.status(422).send(joiErrors(paramError));

  const { error, value } = UpdateDependentSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await updateDependentService({
    barbershopId: req.user!.barbershopId,
    dependentId: req.params.id,
    data: value,
  });

  return res.status(200).send(result);
}

/* ───── DELETE ───── */
export async function deleteDependent(req: Request, res: Response) {
  const { error } = DependentIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteDependentService({
    barbershopId: req.user!.barbershopId,
    dependentId: req.params.id,
  });

  return res.status(200).send(result);
}
