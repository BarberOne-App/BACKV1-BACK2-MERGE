// controllers/platformSubscriptionController.ts

import { Request, Response } from "express";
import {
  ReactivatePlatformSubscriptionBodySchema,
  ReactivatePlatformSubscriptionParamsSchema,
} from "../models/platformSubscriptionSchemas.js";
import {
  reactivateBarbershopPlatformSubscriptionService,
} from "../services/platformSubscriptionService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function reactivateBarbershopPlatformSubscription(
  req: Request,
  res: Response
) {
  const p = ReactivatePlatformSubscriptionParamsSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = ReactivatePlatformSubscriptionBodySchema.validate(req.body, {
    abortEarly: false,
  });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await reactivateBarbershopPlatformSubscriptionService({
    barbershopId: req.params.barbershopId,
    platformPlanId: b.value.platformPlanId,
    amount: b.value.amount,
    cardToken: b.value.cardToken,
    customer: b.value.customer,
    subscriptionIntentToken: b.value.subscriptionIntentToken,
  });

  return res.status(200).send(result);
}