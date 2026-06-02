import joi from "joi";

export const CreateGalleryImageSchema = joi
  .object({
    url: joi.string().uri().required(),
    alt: joi.string().trim().allow("", null).optional(),
    sortOrder: joi.number().integer().min(0).optional().default(0),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const GalleryImageIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
