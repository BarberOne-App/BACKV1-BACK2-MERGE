import joi from 'joi';

export const CreateExtraEmployeePaymentSchema = joi
  .object({
    employeeId: joi.string().uuid().required(),
    amount: joi.number().min(0.01).required(),
    date: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "date deve ser YYYY-MM-DD" }),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CreateEmployeePaymentSchema = joi
  .object({
    employeeId: joi.string().uuid().required(),
    employeeName: joi.string().trim().min(1).optional(),
    period: joi.string().valid('semanal', 'quinzenal', 'mensal', 'weekly', 'biweekly', 'monthly'),
    frequency: joi
      .string()
      .valid('semanal', 'quinzenal', 'mensal', 'weekly', 'biweekly', 'monthly'),
    periodStart: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "periodStart deve ser YYYY-MM-DD" }),
    periodEnd: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "periodEnd deve ser YYYY-MM-DD" }),
    salarioFixo: joi.number().min(0).default(0),
    commission: joi.number().min(0).default(0),
    totalVales: joi.number().min(0).default(0),
    liquido: joi.number().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });
