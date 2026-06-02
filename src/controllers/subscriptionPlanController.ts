import { Request, Response } from "express";
import {
  CreatePlanSchema,
  ListPlansQuerySchema,
  PlanIdParamSchema,
  UpdatePlanSchema,
} from "../models/subscriptionPlanSchemas.js";
import {
  createPlanService,
  deletePlanService,
  getPlanByIdService,
  listPlansService,
  updatePlanService,
} from "../services/subscriptionPlanService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listPlans(req: Request, res: Response) {
  const { error, value } = ListPlansQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listPlansService({
    barbershopId: req.user!.barbershopId,
    activeOnly: value.activeOnly,
  });

  return res.status(200).send(result);
}

/* ───── GET BY ID ───── */
export async function getPlanById(req: Request, res: Response) {
  const { error } = PlanIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getPlanByIdService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createPlan(req: Request, res: Response) {
  const { error, value } = CreatePlanSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createPlanService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updatePlan(req: Request, res: Response) {
  const p = PlanIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdatePlanSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updatePlanService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

/* ───── DELETE ───── */
export async function deletePlan(req: Request, res: Response) {
  const { error } = PlanIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deletePlanService({
    barbershopId: req.user!.barbershopId,
    planId: req.params.id,
  });

  return res.status(200).send(result);
}
