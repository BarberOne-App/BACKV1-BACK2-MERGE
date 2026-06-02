// controllers/pagarmeSubscriptionController.ts
import { Request, Response, NextFunction } from 'express';
import { createPagarmeClientSubscriptionService } from '../services/pagarmeSubscriptionService.js';
import { createPagarmeBarbershopPlatformSubscriptionService } from '../services/pagarmePlatformSubscriptionService.js';
import { CreateBarbershopPlatformSubscriptionSchema } from '../models/pagarmeSubscriptionSchemas.js';

export async function createPagarmeClientSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await createPagarmeClientSubscriptionService(req.body, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function createPagarmeBarbershopPlatformSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { error, value } = CreateBarbershopPlatformSubscriptionSchema.validate(req.body);

    if (error) {
      return res.status(422).json(error.details.map((detail) => detail.message));
    }

    const result = await createPagarmeBarbershopPlatformSubscriptionService(value, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}
