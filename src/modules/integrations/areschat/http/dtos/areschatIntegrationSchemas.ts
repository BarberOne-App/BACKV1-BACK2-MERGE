import Joi from "joi";

export const ListServicesQuerySchema = Joi.object({
  q: Joi.string().trim().allow("", null)
});

export const ListProfessionalsQuerySchema = Joi.object({
  q: Joi.string().trim().allow("", null),
  serviceId: Joi.string().uuid().optional(),
  customerId: Joi.string().uuid().optional()
});

export const AvailabilityQuerySchema = Joi.object({
  professionalId: Joi.string().uuid().required(),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  serviceId: Joi.string().uuid().optional(),
  durationMinutes: Joi.number().integer().min(1).optional()
}).or("serviceId", "durationMinutes");

export const EligibilityBodySchema = Joi.object({
  channel: Joi.string().trim().default("whatsapp"),
  identifierType: Joi.string()
    .valid("phone", "email", "document")
    .required(),
  identifierValue: Joi.string().trim().required(),
  context: Joi.object().unknown(true).optional()
});

export const CreateCustomerBodySchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  phone: Joi.string().trim().allow("", null).optional(),
  email: Joi.string().trim().lowercase().email().allow("", null).optional(),
  document: Joi.string().trim().allow("", null).optional(),
  context: Joi.object().unknown(true).optional()
})
  .or("phone", "email", "document")
  .messages({
    "object.missing": "Informe ao menos phone, email ou document"
  });

export const CreateAppointmentBodySchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  professionalId: Joi.string().uuid().required(),
  dependentId: Joi.string().uuid().allow(null).optional(),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  time: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .required(),
  notes: Joi.string().trim().allow("", null).optional(),
  paymentMethodId: Joi.string().trim().allow("", null).optional(),
  paymentMethod: Joi.string().trim().allow("", null).optional(),
  serviceId: Joi.string().uuid().optional(),
  serviceIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
  context: Joi.object().unknown(true).optional()
})
  .xor("serviceId", "serviceIds")
  .messages({
    "object.xor": "Informe serviceId ou serviceIds"
  });

export const AppointmentIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
});
