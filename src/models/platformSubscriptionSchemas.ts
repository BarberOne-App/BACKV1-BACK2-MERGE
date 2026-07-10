// models/platformSubscriptionSchemas.ts

import Joi from "joi";

export const ReactivatePlatformSubscriptionParamsSchema = Joi.object({
    barbershopId: Joi.string().required(),
});

export const ReactivatePlatformSubscriptionBodySchema = Joi.object({
    platformPlanId: Joi.string().required(),

    amount: Joi.number().min(0).required(),

    subscriptionIntentToken: Joi.string().required(),

    cardToken: Joi.string().required(),

    customer: Joi.object({
        name: Joi.string().allow("", null),
        email: Joi.string().email().allow("", null),
        document: Joi.string().allow("", null),
        phone: Joi.string().allow("", null),
    }).optional(),
});