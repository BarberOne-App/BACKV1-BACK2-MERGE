import joi from "joi";

export const LANDING_LEAD_STATUSES = ["new", "in_contact", "converted", "discarded"] as const;
export const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
export function isValidCnpj(value: unknown) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const digit = (length: number) => {
    let sum = 0; let weight = length - 7;
    for (let index = 0; index < length; index += 1) { sum += Number(cnpj[index]) * weight--; if (weight < 2) weight = 9; }
    const result = 11 - (sum % 11); return result > 9 ? 0 : result;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}
const phone = joi.string().custom((value, helpers) => { const digits = onlyDigits(value); return digits.length === 10 || digits.length === 11 ? digits : helpers.error("string.phone"); }).messages({ "string.phone": "Telefone deve conter DDD e 10 ou 11 digitos" });
const cnpj = joi.string().allow("", null).custom((value, helpers) => { if (!value) return null; const digits = onlyDigits(value); return isValidCnpj(digits) ? digits : helpers.error("string.cnpj"); }).messages({ "string.cnpj": "CNPJ invalido" });

export const CreateLandingLeadSchema = joi.object({ name: joi.string().trim().min(2).max(120).required(), email: joi.string().trim().lowercase().email().max(254).required(), phone: phone.required(), cnpj: cnpj.optional() }).options({ abortEarly: false, stripUnknown: true });
export const LandingLeadIdParamSchema = joi.object({ id: joi.string().uuid().required() }).options({ abortEarly: false, stripUnknown: true });
export const ListLandingLeadsQuerySchema = joi.object({ q: joi.string().trim().allow("").max(120).optional(), status: joi.string().valid(...LANDING_LEAD_STATUSES).optional(), page: joi.number().integer().min(1).default(1), limit: joi.number().integer().min(1).max(100).default(20), sortOrder: joi.string().valid("asc", "desc").default("desc") }).options({ abortEarly: false, stripUnknown: true });
export const UpdateLandingLeadSchema = joi.object({ status: joi.string().valid(...LANDING_LEAD_STATUSES).optional(), notes: joi.string().trim().max(4000).allow("", null).optional(), contactedAt: joi.date().iso().allow(null).optional() }).min(1).options({ abortEarly: false, stripUnknown: true });
