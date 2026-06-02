import joi from 'joi';

export const CreateBarbershopPlatformSubscriptionSchema = joi
    .object({
        barbershopId: joi.string().trim().uuid().optional(),
        selectedPlan: joi.string().trim().valid('basic', 'premium', 'master').required(),
        cardToken: joi.string().trim().required(),
        amount: joi.number().positive().precision(2).optional(),
        customer: joi
            .object({
                name: joi.string().trim().min(2).optional(),
                email: joi.string().trim().email().optional(),
                document: joi.string().trim().allow('', null).optional(),
                phone: joi.string().trim().allow('', null).optional(),
            })
            .optional(),
    })
    .options({ abortEarly: false, stripUnknown: true });
