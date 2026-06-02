import { Request, Response } from "express";
import {
  CreateUserSchema,
  ImportUsersSchema,
  ListUsersQuerySchema,
  UpdatePermissionsSchema,
  UpdateUserSchema,
  UserIdParamSchema,
} from "../models/userSchemas.js";
import {
  checkEmailService,
  createUserService,
  deleteUserService,
  getUserByIdService,
  importUsersService,
  listUsersService,
  updatePermissionsService,
  updateUserService,
} from "../services/userService.js";
import { validatePlanUserLimit } from "../services/planLimitService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

function getAuthenticatedBarbershopId(req: Request) {
  return req.user?.barbershopId || null;
}

function getImportHttpStatus(result: {
  createdCount?: number;
  failedCount?: number;
  skippedCount?: number;
  success?: boolean;
}) {
  const createdCount = result.createdCount ?? 0;
  const failedCount = result.failedCount ?? 0;
  const skippedCount = result.skippedCount ?? 0;

  if (failedCount > 0 && createdCount === 0 && skippedCount === 0) {
    return 422;
  }

  if (createdCount > 0 && failedCount === 0) {
    return 201;
  }

  if (createdCount > 0 || skippedCount > 0 || failedCount > 0) {
    return 200;
  }

  return 422;
}

function buildRepeatedSpreadsheetMessage(params: {
  totalRows: number;
  createdCount?: number;
  failedCount?: number;
  skippedCount?: number;
}) {
  const totalRows = params.totalRows ?? 0;
  const createdCount = params.createdCount ?? 0;
  const failedCount = params.failedCount ?? 0;
  const skippedCount = params.skippedCount ?? 0;

  const allRowsWereIgnored =
    totalRows > 0 &&
    createdCount === 0 &&
    failedCount === 0 &&
    skippedCount === totalRows;

  if (allRowsWereIgnored) {
    return "Nenhum novo usuário foi importado. Esta planilha já foi importada anteriormente ou todos os registros já existem no sistema.";
  }

  return null;
}

export async function listUsers(req: Request, res: Response) {
  const { error, value } = ListUsersQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await listUsersService({
    barbershopId,
    actorRole: req.user!.role,
    query: {
      role: value.role,
      excludeRole: value.excludeRole,
      q: value.q,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function getUserById(req: Request, res: Response) {
  const { error } = UserIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await getUserByIdService({
    barbershopId,
    userId: req.params.id,
  });

  return res.status(200).send(result);
}

export async function checkEmail(req: Request, res: Response) {
  const email = req.params.email;
  if (!email) return res.status(400).send(["E-mail obrigatório"]);

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await checkEmailService({
    barbershopId,
    email,
  });

  return res.status(200).send(result);
}

export async function createUser(req: Request, res: Response) {
  const { error, value } = CreateUserSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  // ✅ Validar limite de usuários por plano antes de criar
  await validatePlanUserLimit(barbershopId, value.role);

  const result = await createUserService({
    barbershopId,
    actorRole: req.user!.role,
    data: value,
  });

  return res.status(201).send(result);
}

export async function importUsers(req: Request, res: Response) {
  const { error, value } = ImportUsersSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send({
      success: false,
      message: "Não foi possível importar a planilha. Verifique os dados obrigatórios.",
      errors: joiErrors(error),
    });
  }

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send({
      success: false,
      message: "Barbearia do usuário autenticado não encontrada.",
      errors: ["Barbearia do usuário autenticado não encontrada"],
    });
  }

  const result = await importUsersService({
    barbershopId,
    actorRole: req.user!.role,
    data: {
      defaultPassword: value.defaultPassword,
      skipExisting: value.skipExisting,
      rows: value.rows,
    },
  });

  const repeatedSpreadsheetMessage = buildRepeatedSpreadsheetMessage({
    totalRows: value.rows.length,
    createdCount: result.createdCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
  });

  const finalMessage = repeatedSpreadsheetMessage || result.message || result.summary;
  const status = getImportHttpStatus({
    createdCount: result.createdCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
    success: result.success,
  });

  return res.status(status).send({
    success: result.success,
    message: finalMessage,
    summary: finalMessage,
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
    errors: result.errors,
  });
}

export async function updateUser(req: Request, res: Response) {
  const p = UserIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdateUserSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await updateUserService({
    barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    userId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

export async function updatePermissions(req: Request, res: Response) {
  const p = UserIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdatePermissionsSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await updatePermissionsService({
    barbershopId,
    actorRole: req.user!.role,
    userId: req.params.id,
    permissions: b.value.permissions,
  });

  return res.status(200).send(result);
}

export async function deleteUser(req: Request, res: Response) {
  const { error } = UserIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = getAuthenticatedBarbershopId(req);
  if (!barbershopId) {
    return res.status(401).send(["Barbearia do usuário autenticado não encontrada"]);
  }

  const result = await deleteUserService({
    barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    userId: req.params.id,
  });

  return res.status(200).send(result);
}
