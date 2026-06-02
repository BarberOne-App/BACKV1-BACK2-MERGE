import { Request, Response } from "express";
import {
  CreateEmployeeValeSchema,
  EmployeeValeIdParamSchema,
} from "../models/employeeValeSchemas.js";
import {
  createEmployeeValeService,
  deleteEmployeeValeService,
  listEmployeeValesService,
} from "../services/employeeValeService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listEmployeeVales(req: Request, res: Response) {
  const result = await listEmployeeValesService(req.user!.barbershopId);
  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createEmployeeVale(req: Request, res: Response) {
  const { error, value } = CreateEmployeeValeSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createEmployeeValeService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── DELETE ───── */
export async function deleteEmployeeVale(req: Request, res: Response) {
  const { error } = EmployeeValeIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteEmployeeValeService({
    barbershopId: req.user!.barbershopId,
    valeId: req.params.id,
  });

  return res.status(200).send(result);
}
