import joi from "joi";

export const CreateSavedCardSchema = joi
  .object({
    number: joi.string().trim().min(13).max(19).required(),
    holderName: joi.string().trim().min(1).required(),
    expiryMonth: joi.string().trim().length(2).required(),
    expiryYear: joi.string().trim().length(2).required(),
    brand: joi.string().trim().allow("", null).default("unknown"),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const SavedCardIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

export const SetMainCardSchema = joi
  .object({
    isMain: joi.boolean().required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const ListSavedCardsQuerySchema = joi
  .object({
    userId: joi.string().uuid().optional(),
  })
  .unknown(true);
