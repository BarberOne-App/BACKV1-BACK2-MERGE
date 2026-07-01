import joi from "joi";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const ListCashClosingsQuerySchema = joi
  .object({
    date: joi.string().pattern(datePattern).optional(),
    periodStart: joi.string().isoDate().optional(),
    periodEnd: joi.string().isoDate().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CashClosingPreviewQuerySchema = joi
  .object({
    date: joi.string().pattern(datePattern).optional(),
    periodStart: joi.string().isoDate().optional(),
    periodEnd: joi.string().isoDate().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CreateCashClosingSchema = joi
  .object({
    periodStart: joi.string().isoDate().optional(),
    periodEnd: joi.string().isoDate().optional(),
    note: joi.string().trim().allow("", null).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CashClosingIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
