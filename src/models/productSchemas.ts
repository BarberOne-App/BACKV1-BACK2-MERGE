import Joi from "joi";

export const CreateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().allow("", null).max(2000).optional(),
  category: Joi.string().trim().allow("", null).max(120).optional(),
  price: Joi.number().precision(2).positive().required(),
  subscriberDiscount: Joi.number().integer().min(0).max(100).optional(),
  imageUrl: Joi.string().uri().allow("", null).optional(),
  stock: Joi.number().integer().min(0).optional(),
  active: Joi.boolean().optional(),
}).required();

const ImportProductRowSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().allow("", null).max(2000).optional(),
  category: Joi.string().trim().allow("", null).max(120).optional(),
  price: Joi.number().precision(2).positive().required(),
  subscriberDiscount: Joi.number().integer().min(0).max(100).optional(),
  imageUrl: Joi.string().uri().allow("", null).optional(),
  stock: Joi.number().integer().min(0).optional(),
  active: Joi.boolean().optional(),
});

export const ImportProductsSchema = Joi.object({
  rows: Joi.array().items(ImportProductRowSchema).min(1).max(500).required(),
}).required();

export const UpdateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().trim().allow("", null).max(2000).optional(),
  category: Joi.string().trim().allow("", null).max(120).optional(),
  price: Joi.number().precision(2).positive().optional(),
  subscriberDiscount: Joi.number().integer().min(0).max(100).optional(),
  imageUrl: Joi.string().uri().allow("", null).optional(),
  stock: Joi.number().integer().min(0).optional(),
  active: Joi.boolean().optional(),
})
  .min(1) // precisa ter ao menos 1 campo
  .required();

export const ListProductsQuerySchema = Joi.object({
  active: Joi.boolean().optional(),
  category: Joi.string().trim().optional(),
  q: Joi.string().trim().max(120).optional(),
}).unknown(true);

export const CreateProductStockMovementSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  type: Joi.string().valid("entry", "exit").required(),
  quantity: Joi.number().integer().min(1).required(),
  purchasePrice: Joi.number().precision(2).min(0).allow(null).optional(),
  salePrice: Joi.number().precision(2).min(0).allow(null).optional(),
  occurredAt: Joi.date().iso().optional(),
  note: Joi.string().trim().allow("", null).max(500).optional(),
}).required();

export const ListProductStockMovementsQuerySchema = Joi.object({
  productId: Joi.string().uuid().optional(),
  type: Joi.string().valid("entry", "exit").optional(),
  q: Joi.string().trim().max(120).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
}).unknown(true);
