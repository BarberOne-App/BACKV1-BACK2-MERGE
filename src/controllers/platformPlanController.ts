import { Request, Response, NextFunction } from 'express';
import {
  CreatePlatformPlanSchema,
  UpdatePlatformPlanSchema,
  PlatformPlanIdParamSchema,
} from '../models/platformPlanSchemas.js';
import {
  listPlatformPlansService,
  getPlatformPlanByIdService,
  createPlatformPlanService,
  updatePlatformPlanService,
  deletePlatformPlanService,
} from '../services/platformPlanService.js';

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ['Dados inválidos'];
}

export async function listPublicPlatformPlansController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const items = await listPlatformPlansService({ activeOnly: true, publicOnly: true });
    console.log(`[GET /public/platform-plans] Retornando ${items.length} plano(s)`);
    return res.json({ items });
  } catch (error) {
    console.error('[GET /public/platform-plans] Erro:', error);
    return next(error);
  }
}

export async function listPlatformPlansController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const items = await listPlatformPlansService({});
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
}

export async function getPlatformPlanByIdController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { error } = PlatformPlanIdParamSchema.validate(req.params);
    if (error) return res.status(422).json(joiErrors(error));

    const result = await getPlatformPlanByIdService(req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function createPlatformPlanController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { error, value } = CreatePlatformPlanSchema.validate(req.body);
    if (error) return res.status(422).json(joiErrors(error));

    const result = await createPlatformPlanService({
      name: value.name,
      description: value.description,
      price: value.price,
      interval: value.interval,
      intervalCount: value.intervalCount,
      trialPeriodDays: value.trialPeriodDays,
      maxBarbers: value.maxBarbers,
      maxAdmins: value.maxAdmins,
      maxReceptionists: value.maxReceptionists,
      isPublic: value.isPublic,
      isRecommended: value.isRecommended,
      sortOrder: value.sortOrder,
      active: value.active,
      features: value.features,
      paymentMethods: value.paymentMethods,
      statementDescriptor: value.statementDescriptor,
      syncPagarme: value.syncPagarme,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function updatePlatformPlanController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const p = PlatformPlanIdParamSchema.validate(req.params);
    if (p.error) return res.status(422).json(joiErrors(p.error));

    const { error, value } = UpdatePlatformPlanSchema.validate(req.body);
    if (error) return res.status(422).json(joiErrors(error));

    const result = await updatePlatformPlanService(req.params.id, value);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function deletePlatformPlanController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { error } = PlatformPlanIdParamSchema.validate(req.params);
    if (error) return res.status(422).json(joiErrors(error));

    const result = await deletePlatformPlanService(req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
