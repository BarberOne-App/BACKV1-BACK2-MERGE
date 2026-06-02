import joi from "joi";

export const CreateDependentSchema = joi
  .object({
    name: joi.string().trim().min(1).required(),
    age: joi.number().integer().min(0).max(17).required(),
    cpf: joi.string().trim().min(11).max(14).required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateDependentSchema = joi
  .object({
    name: joi.string().trim().min(1).optional(),
    age: joi.number().integer().min(0).max(17).optional(),
    cpf: joi.string().trim().min(11).max(14).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const DependentIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

export const ListDependentsQuerySchema = joi
  .object({
    parentId: joi.string().uuid().optional(),
  })
  .unknown(true);
