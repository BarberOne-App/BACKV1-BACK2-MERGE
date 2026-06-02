import joi from "joi";

export const CreateAppointmentSchema = joi
  .object({
    barberId: joi.string().uuid().required(),
    clientId: joi.string().uuid().required(),
    dependentId: joi.string().uuid().optional().allow(null),
    date: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "date deve ser YYYY-MM-DD" }),
    time: joi
      .string()
      .pattern(/^\d{2}:\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "time deve ser HH:MM" }),
    notes: joi.string().trim().allow("", null).optional(),
    allowOutsideBusinessHours: joi.boolean().optional().default(false),
    services: joi
      .array()
      .items(
        joi.object({
          id: joi.string().uuid().required(),
          name: joi.string().required(),
          basePrice: joi.number().min(0),
          duration: joi.number().integer().min(1),
          durationMinutes: joi.number().integer().min(1),
          duration_minutes: joi.number().integer().min(1),
          quantity: joi.number().integer().min(1).optional(),
        })
      )
      .min(1)
      .required(),
    products: joi
      .array()
      .items(
        joi.object({
          id: joi.string().uuid().required(),
          name: joi.string().required(),
          price: joi.number().min(0).required(),
          quantity: joi.number().integer().min(1).optional(),
          discount: joi.number().min(0).max(100).optional(),
        })
      )
      .optional()
      .default([]),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateAppointmentSchema = joi
  .object({
    status: joi.string().valid("scheduled", "confirmed", "completed", "cancelled", "no_show").optional(),
    notes: joi.string().trim().allow("", null).optional(),
    barberId: joi.string().uuid().optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const ListAppointmentsQuerySchema = joi
  .object({
    barberId: joi.string().uuid().optional(),
    clientId: joi.string().uuid().optional(),
    status: joi.string().valid("scheduled", "confirmed", "completed", "cancelled", "no_show", "active").optional(),
    dateFrom: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
    allAppointments: joi.boolean().optional().description("Se true, retorna TODOS os agendamentos da barbearia para validação de disponibilidade"),
  })
  .unknown(true);

export const AvailableSlotsQuerySchema = joi
  .object({
    barberId: joi.string().uuid().required(),
    date: joi
      .string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({ "string.pattern.base": "date deve ser YYYY-MM-DD" }),
    duration: joi.number().integer().min(1).required(),
  })
  .unknown(true);

export const AppointmentIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
