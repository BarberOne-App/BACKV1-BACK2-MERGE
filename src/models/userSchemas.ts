import joi from "joi";

const uuidParam = joi.object({
  id: joi.string().uuid().required(),
});

const permissionsObject = joi.object({
  viewAdmin: joi.boolean().optional(),
  manageEmployees: joi.boolean().optional(),
  manageCustomers: joi.boolean().optional(),
  manageProducts: joi.boolean().optional(),
  addProducts: joi.boolean().optional(),
  editProducts: joi.boolean().optional(),
  manageServices: joi.boolean().optional(),
  addServices: joi.boolean().optional(),
  editServices: joi.boolean().optional(),
  managePayments: joi.boolean().optional(),
  managePayroll: joi.boolean().optional(),
  manageAgendamentos: joi.boolean().optional(),
  manageOffScheduleAppointments: joi.boolean().optional(),
  manageBlockedDates: joi.boolean().optional(),
  manageBenefits: joi.boolean().optional(),
  manageSettings: joi.boolean().optional(),
  manageGallery: joi.boolean().optional(),
});

const phoneSchema = joi.string().trim().pattern(/^\d+$/).min(10).max(15);
const cpfSchema = joi.string().trim().length(11).pattern(/^\d+$/);

export const CreateUserSchema = joi
  .object({
    name: joi.string().trim().min(2).required(),
    email: joi.string().trim().lowercase().email().required(),
    phone: phoneSchema.allow("", null).optional(),
    cpf: cpfSchema.allow("", null).optional(),
    password: joi.string().min(4).required(),
    role: joi.string().valid("admin", "barber", "receptionist", "client").required(),
    isAdmin: joi.boolean().optional(),
    permissions: permissionsObject.optional(),
    photoUrl: joi.string().uri().allow("", null).optional(),
    birthDate: joi.date().iso().allow(null).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

const ImportUserRowSchema = joi
  .object({
    name: joi.string().trim().min(2).required(),
    email: joi.string().trim().lowercase().email().required(),
    phone: phoneSchema.allow("", null).optional(),
    cpf: cpfSchema.allow("", null).optional(),
    birthDate: joi.date().iso().allow(null, "").optional(),
    role: joi.string().valid("admin", "barber", "receptionist", "client").optional(),
    isAdmin: joi.boolean().optional(),
    permissions: permissionsObject.optional(),
    photoUrl: joi.string().uri().allow("", null).optional(),
  })
  .custom((value, helpers) => {
    const role = value.role ?? "client";
    const isAdmin = value.isAdmin === true || role === "admin";

    if (!isAdmin) {
      const missingFields: string[] = [];

      if (!value.name || !String(value.name).trim()) missingFields.push("name");
      if (!value.email || !String(value.email).trim()) missingFields.push("email");
      if (!value.phone || !String(value.phone).trim()) missingFields.push("phone");
      if (!value.cpf || !String(value.cpf).trim()) missingFields.push("cpf");

      if (missingFields.length > 0) {
        return helpers.error("any.custom", {
          message: `Para importar usuários não admin, os campos name, email, phone e cpf são obrigatórios. Faltando: ${missingFields.join(", ")}`,
        });
      }
    }

    return value;
  }, "validação de obrigatoriedade por tipo de usuário")
  .messages({
    "any.custom": "{{#message}}",
    "string.pattern.base": "O campo {{#label}} deve conter apenas números.",
    "string.length": "O campo {{#label}} deve ter {{#limit}} caracteres.",
    "string.email": "O campo {{#label}} deve ser um e-mail válido.",
    "string.min": "O campo {{#label}} deve ter no mínimo {{#limit}} caracteres.",
    "any.required": "O campo {{#label}} é obrigatório.",
  });

export const ImportUsersSchema = joi
  .object({
    defaultPassword: joi.string().trim().min(4).max(100).optional(),
    skipExisting: joi.boolean().optional(),
    rows: joi.array().items(ImportUserRowSchema).min(1).max(500).required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateUserSchema = joi
  .object({
    name: joi.string().trim().min(2).optional(),
    email: joi.string().trim().lowercase().email().optional(),
    phone: phoneSchema.allow(null, "").optional(),
    cpf: cpfSchema.allow(null, "").optional(),
    birthDate: joi.date().iso().allow(null, "").optional(),
    role: joi
      .string()
      .valid("admin", "barber", "receptionist", "client")
      .optional(),
    isAdmin: joi.boolean().optional(),
    photoUrl: joi.string().uri().allow(null, "").optional(),
    salary: joi.number().min(0).allow(null).optional(),

    currentPassword: joi.string().min(4).optional(),
    newPassword: joi.string().min(4).optional(),
    resetPassword: joi.boolean().optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const UpdatePermissionsSchema = joi
  .object({
    permissions: permissionsObject.required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const ListUsersQuerySchema = joi
  .object({
    role: joi.string().valid("admin", "barber", "receptionist", "client").optional(),
    excludeRole: joi.string().valid("admin", "barber", "receptionist", "client").optional(),
    q: joi.string().trim().max(120).optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(500).optional(),
  })
  .unknown(true);

export const UserIdParamSchema = uuidParam;
