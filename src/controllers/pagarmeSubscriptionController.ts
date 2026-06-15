// controllers/pagarmeSubscriptionController.ts
import { Request, Response, NextFunction } from 'express';
import {
  confirmPagarmeClientPixOrderService,
  createPagarmeClientPixOrderService,
  createPagarmeClientSubscriptionService,
} from '../services/pagarmeSubscriptionService.js';
import {
  createPagarmeBarbershopPlatformSubscriptionService,
  getBarbershopPlatformSubscriptionService,
  cancelBarbershopPlatformSubscriptionService,
} from '../services/pagarmePlatformSubscriptionService.js';
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

export async function createPagarmeClientPixOrderController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createPagarmeClientPixOrderService(req.body, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function confirmPagarmeClientPixOrderController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await confirmPagarmeClientPixOrderService(req.body, req.user);
    return res.status(200).json(result);
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

export async function getBarbershopPlatformSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const barbershopId = String(req.user?.barbershopId || '');
    if (!barbershopId) return res.status(400).json({ message: 'Barbearia não identificada.' });
    const result = await getBarbershopPlatformSubscriptionService(barbershopId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function cancelBarbershopPlatformSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const barbershopId = String(req.user?.barbershopId || '');
    if (!barbershopId) return res.status(400).json({ message: 'Barbearia não identificada.' });
    const result = await cancelBarbershopPlatformSubscriptionService(barbershopId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
