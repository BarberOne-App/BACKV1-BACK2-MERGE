import joi from "joi";

export const CreateSubscriptionSchema = joi
  .object({
    userId: joi.string().uuid().optional(),
    planId: joi.string().uuid().required(),
    amount: joi.number().min(0).required(),
    paymentMethod: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .optional(),
    isRecurring: joi.boolean().optional().default(true),
    autoRenewal: joi.boolean().optional().default(true),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateSubscriptionSchema = joi
  .object({
    planId: joi.string().uuid().optional(),
    status: joi.string().valid("active", "paused", "cancelled", "expired", "pending").optional(),
    monthlyBarberId: joi.string().uuid().allow(null).optional(),
    autoRenewal: joi.boolean().optional(),
    isRecurring: joi.boolean().optional(),
    paymentMethod: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .optional(),
    notes: joi.string().trim().allow("", null).optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const ListSubscriptionsQuerySchema = joi
  .object({
    userId: joi.string().uuid().optional(),
    status: joi.string().valid("active", "paused", "cancelled", "expired", "pending").optional(),
    search: joi.string().trim().max(100).optional(),
    searchType: joi.string().valid("name", "cpf").optional().default("name"),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);

export const SubscriptionIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
