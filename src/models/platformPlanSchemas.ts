import joi from 'joi';

export const CreatePlatformPlanSchema = joi.object({
  name: joi.string().trim().min(1).max(100).required(),
  description: joi.string().trim().allow('', null).optional(),
  price: joi.number().positive().required(),
  interval: joi.string().valid('week', 'month', 'year').default('month'),
  intervalCount: joi.number().integer().min(1).default(1),
  trialPeriodDays: joi.number().integer().min(0).default(0),
  maxBarbers: joi.number().integer().min(0).allow(null).optional(),
  maxAdmins: joi.number().integer().min(0).allow(null).optional(),
  maxReceptionists: joi.number().integer().min(0).allow(null).optional(),
  isPublic: joi.boolean().default(false),
  isRecommended: joi.boolean().default(false),
  sortOrder: joi.number().integer().default(0),
  active: joi.boolean().default(true),
  features: joi.array().items(joi.string().trim().min(1)).default([]),
  paymentMethods: joi
    .array()
    .items(joi.string().valid('credit_card', 'boleto'))
    .default(['credit_card']),
  statementDescriptor: joi.string().trim().max(13).allow('', null).optional(),
  syncPagarme: joi.boolean().default(true),
}).options({ abortEarly: false, stripUnknown: true });

export const UpdatePlatformPlanSchema = joi.object({
  name: joi.string().trim().min(1).max(100).optional(),
  description: joi.string().trim().allow('', null).optional(),
  price: joi.number().positive().optional(),
  interval: joi.string().valid('week', 'month', 'year').optional(),
  intervalCount: joi.number().integer().min(1).optional(),
  trialPeriodDays: joi.number().integer().min(0).optional(),
  maxBarbers: joi.number().integer().min(0).allow(null).optional(),
  maxAdmins: joi.number().integer().min(0).allow(null).optional(),
  maxReceptionists: joi.number().integer().min(0).allow(null).optional(),
  isPublic: joi.boolean().optional(),
  isRecommended: joi.boolean().optional(),
  sortOrder: joi.number().integer().optional(),
  active: joi.boolean().optional(),
  features: joi.array().items(joi.string().trim().min(1)).optional(),
  statementDescriptor: joi.string().trim().max(13).allow('', null).optional(),
  paymentMethods: joi
    .array()
    .items(joi.string().valid('credit_card', 'boleto'))
    .optional(),
}).min(1).options({ abortEarly: false, stripUnknown: true });

export const PlatformPlanIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});
