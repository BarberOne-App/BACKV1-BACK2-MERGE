import joi from "joi";

export const CreateEmployeeValeSchema = joi
  .object({
    employeeId: joi.string().uuid().required(),
    valor: joi.number().positive().required(),
    descricao: joi.string().trim().min(1).optional(),
    motivo: joi.string().trim().min(1).optional(),
    observacao: joi.string().trim().allow("", null).optional(),
    data: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "data deve ser YYYY-MM-DD" }),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const EmployeeValeIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
