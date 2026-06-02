import joi from "joi";

export const CreateBarberSchema = joi
  .object({
    displayName: joi.string().trim().min(2).required(),
    specialty: joi.string().trim().allow("", null).optional(),
    photoUrl: joi.string().uri().allow("", null).optional(),
    commissionPercent: joi.number().integer().min(0).max(100).allow(null).optional(),
    userId: joi.string().uuid().allow(null).optional(),
    salarioFixo: joi.number().min(0).allow(0).optional(),
    serviceIds: joi.array().items(joi.string().uuid()).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateBarberSchema = joi
  .object({
    displayName: joi.string().trim().min(2).optional(),
    specialty: joi.string().trim().allow("", null).optional(),
    photoUrl: joi.string().uri().allow("", null).optional(),
    commissionPercent: joi.number().integer().min(0).max(100).allow(null).optional(),
    salarioFixo: joi.number().min(0).allow(0).optional(),
    serviceIds: joi.array().items(joi.string().uuid()).optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const LinkUserSchema = joi
  .object({
    userId: joi.string().uuid().required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const BarberIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

export const ListBarbersQuerySchema = joi
  .object({
    q: joi.string().trim().max(120).optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);
