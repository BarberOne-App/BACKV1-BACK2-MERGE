
import joi from "joi";

const email = joi.string().trim().lowercase().email();
const password = joi.string().min(4);

const slug = joi
  .string()
  .trim()
  .min(2)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .messages({
    "string.pattern.base": "slug inválido (use letras/números e hífen).",
  });

const phone = joi.string().trim().allow("", null).optional();

export const LoginSchema = joi
  .object({
    // slug: slug.required(),
    email: email.required(),
    password: password.required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RegisterClientSchema = joi
  .object({
    slug: slug.required(),
    name: joi.string().trim().min(2).required(),
    email: email.required(),
    cpf: joi.string().trim().allow("", null).optional(),
    phone,
    birthDate: joi.date().max('now').optional(),
    password: password.required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RegisterClientGoogleSchema = joi
  .object({
    slug: slug.allow("", null).optional(),
    accessToken: joi.string().trim().required(),
    profileData: joi
      .object({
        cpf: joi.string().trim().allow("", null).optional(),
        phone,
        birthDate: joi.date().max('now').optional(),
        password: password.allow("", null).optional(),
      })
      .optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RegisterBarbershopSchema = joi
  .object({
    barbershopName: joi.string().trim().min(2).required(),

    slug: slug.optional(),
    cnpj: joi.string().trim().allow("", null).optional(),

    phone: joi.string().trim().allow("", null).optional(),

    adminName: joi.string().trim().min(2).required(),
    adminEmail: email.required(),
    adminPhone: joi.string().trim().allow("", null).optional(),

    password: password.required(),
    selectedPlan: joi.string().trim().required(),
    subscriptionBarberRule: joi.string().trim().valid("fixed", "free_choice").default("fixed"),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RegisterBarberSchema = joi
  .object({
    name: joi.string().trim().min(2).required(),
    email: email.required(),
    phone,
    password: password.required(),

    displayName: joi.string().trim().empty("").optional(),
    specialty: joi.string().trim().empty("").optional(),
    photoUrl: joi.string().uri().trim().empty("").optional(),
    commissionPercent: joi.number().integer().min(0).max(100).allow(null),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RegisterSuperAdminSchema = joi
  .object({
    setupKey: joi.string().trim().min(8).required(),
    name: joi.string().trim().min(2).required(),
    email: email.required(),
    password: password.required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const RefreshTokenSchema = joi
  .object({
    refreshToken: joi.string().required(),
  })
  .options({ abortEarly: false, stripUnknown: true });
