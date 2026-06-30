import joi from "joi";

/* ═══════ Payments (subscription payments) ═══════ */

export const CreatePaymentSchema = joi
  .object({
    userId: joi.string().uuid().required(),
    subscriptionId: joi.string().uuid().optional(),
    appointmentId: joi.string().uuid().optional(),
    amount: joi.number().min(0).required(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .optional()
      .default("local"),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional()
      .default("pending"),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CreateManualSubscriptionPaymentSchema = joi
  .object({
    subscriptionId: joi.string().uuid().required(),
    amount: joi.number().min(0.01).required(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local")
      .required(),
    paidAt: joi.date().iso().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const CreateCashOutSchema = joi
  .object({
    category: joi
      .string()
      .valid("products", "employees", "refunds", "other")
      .required(),
    amount: joi.number().min(0.01).required(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local")
      .required(),
    description: joi.string().trim().max(255).allow("", null).optional(),
    paidAt: joi.date().iso().optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdatePaymentSchema = joi
  .object({
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .optional(),
    paidAt: joi.date().iso().optional(),
    noShow: joi.boolean().optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const ListPaymentsQuerySchema = joi
  .object({
    userId: joi.string().uuid().optional(),
    subscriptionId: joi.string().uuid().optional(),
    appointmentId: joi.string().uuid().optional(),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);

export const PaymentIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

/* ═══════ Appointment Payments ═══════ */

export const CreateAppointmentPaymentSchema = joi
  .object({
    appointmentId: joi.string().uuid().required(),
    userId: joi.string().uuid().required(),
    amount: joi.number().min(0).required(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local", "subscription")
      .required(),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional()
      .default("pending"),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const ListAppointmentPaymentsQuerySchema = joi
  .object({
    appointmentId: joi.string().uuid().optional(),
    userId: joi.string().uuid().optional(),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);

/* ═══════ Extra Payments ═══════ */

export const CreateExtraPaymentSchema = joi
  .object({
    userId: joi.string().uuid().optional().allow(null, ""),
    amount: joi.number().min(0.01).required(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local")
      .required(),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional()
      .default("pending"),
    description: joi.string().max(255).optional().allow(null, ""),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const ListExtraPaymentsQuerySchema = joi
  .object({
    userId: joi.string().uuid().optional(),
    status: joi
      .string()
      .valid("pending", "approved", "paid", "failed", "refunded", "covered")
      .optional(),
    method: joi
      .string()
      .valid("pix", "debito", "credito", "dinheiro", "local")
      .optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);
