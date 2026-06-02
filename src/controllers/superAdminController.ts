import { Request, Response } from "express";
import {
  SuperAdminBarbershopIdParamSchema,
  SuperAdminListBarbershopsQuerySchema,
  SuperAdminUpdateBarbershopStatusSchema,
  SuperAdminListUsersQuerySchema,
  SuperAdminUpdateUserSchema,
  SuperAdminUserIdParamSchema,
} from "../models/superAdminSchemas.js";
import {
  getSuperAdminBarbershopByIdService,
  getSuperAdminDashboardService,
  listSuperAdminBarbershopsService,
  listSuperAdminUsersService,
  listSuperAdminBarbershopUsersService,
  updateSuperAdminBarbershopStatusService,
  resetUserPasswordService,
  updateSuperAdminUserService,
} from "../services/superAdminService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function getSuperAdminDashboard(_req: Request, res: Response) {
  const result = await getSuperAdminDashboardService();
  return res.status(200).send(result);
}

export async function resetUserPassword(req: Request, res: Response) {
  const userId = String(req.params.id);
  const newPassword = req.body?.newPassword;

  const result = await resetUserPasswordService({ userId, newPassword });
  return res.status(200).send(result);
}

export async function listSuperAdminUsers(req: Request, res: Response) {
  const { error, value } = SuperAdminListUsersQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listSuperAdminUsersService({
    q: value.q || undefined,
    role: value.role || undefined,
    page: value.page,
    limit: value.limit,
  });

  return res.status(200).send(result);
}

export async function updateSuperAdminUser(req: Request, res: Response) {
  const p = SuperAdminUserIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = SuperAdminUpdateUserSchema.validate(req.body, {
    abortEarly: false,
  });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updateSuperAdminUserService({
    userId: req.params.id,
    data: {
      email: b.value.email,
      phone: b.value.phone,
      newPassword: b.value.newPassword,
    },
  });

  return res.status(200).send(result);
}

export async function listSuperAdminBarbershops(req: Request, res: Response) {
  const { error, value } = SuperAdminListBarbershopsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listSuperAdminBarbershopsService({
    q: value.q || undefined,
    status: value.status || undefined,
    plan: value.plan || undefined,
    subscriptionStatus: value.subscriptionStatus || undefined,
    createdFrom: value.createdFrom,
    createdTo: value.createdTo,
    page: value.page,
    limit: value.limit,
    sortBy: value.sortBy,
    sortOrder: value.sortOrder,
  });

  return res.status(200).send(result);
}

export async function getSuperAdminBarbershopById(req: Request, res: Response) {
  const { error } = SuperAdminBarbershopIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await getSuperAdminBarbershopByIdService(req.params.id);
  return res.status(200).send(result);
}

export async function listSuperAdminBarbershopUsers(req: Request, res: Response) {
  const { error } = SuperAdminBarbershopIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) return res.status(422).send(joiErrors(error));

  const result = await listSuperAdminBarbershopUsersService(req.params.id);
  return res.status(200).send(result);
}

export async function updateSuperAdminBarbershopStatus(req: Request, res: Response) {
  const p = SuperAdminBarbershopIdParamSchema.validate(req.params, {
    abortEarly: false,
  });
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = SuperAdminUpdateBarbershopStatusSchema.validate(req.body, {
    abortEarly: false,
  });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updateSuperAdminBarbershopStatusService({
    barbershopId: req.params.id,
    status: b.value.status,
    reason: b.value.reason || null,
  });

  return res.status(200).send(result);
}
