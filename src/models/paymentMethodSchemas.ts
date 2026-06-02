import joi from "joi";

export const CreatePaymentMethodSchema = joi
  .object({
    userId: joi.string().uuid().required(),
    type: joi.string().trim().min(1).required(), // "credit", "debit"
    token: joi.string().trim().min(1).required(),
    provider: joi.string().trim().allow("", null).optional(),
    brand: joi.string().trim().allow("", null).optional(),
    last4: joi.string().trim().length(4).allow("", null).optional(),
    expMonth: joi.number().integer().min(1).max(12).optional(),
    expYear: joi.number().integer().min(2024).max(2050).optional(),
    holderName: joi.string().trim().allow("", null).optional(),
    isDefault: joi.boolean().optional().default(false),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const PaymentMethodIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

export const ListPaymentMethodsQuerySchema = joi
  .object({
    userId: joi.string().uuid().required(),
  })
  .unknown(true);
