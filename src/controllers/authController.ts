
import { Request, Response } from "express";
import {
  LoginSchema,
  RegisterBarberSchema,
  RegisterBarbershopSchema,
  RegisterClientSchema,
  RefreshTokenSchema,
  RegisterClientGoogleSchema,
  RegisterSuperAdminSchema
} from "../models/authSchemas.js";
import {
  loginService,
  googleAuthService,
  meService,
  switchBarbershopService,
  refreshTokenService,
  listPublicBarbershopsService,
  registerBarberService,
  registerBarbershopService,
  registerClientService,
  registerSuperAdminService,
  forgotPasswordService,
  resetPasswordService,
} from "../services/authService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function login(req: Request, res: Response) {
  const { error } = LoginSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await loginService(req.body);
  return res.status(200).send(result);
}

export async function registerBarbershop(req: Request, res: Response) {
  const { error } = RegisterBarbershopSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  console.log("Registering barbershop with data:", req.body);

  const result = await registerBarbershopService(req.body);
  return res.status(201).send(result);
}

export async function registerClient(req: Request, res: Response) {
  const { error } = RegisterClientSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await registerClientService(req.body);
  return res.status(201).send(result);
}

export async function listPublicBarbershops(_req: Request, res: Response) {
  const result = await listPublicBarbershopsService();
  return res.status(200).send(result);
}

export async function googleAuth(req: Request, res: Response) {
  const { error, value } = RegisterClientGoogleSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await googleAuthService(value);
  return res.status(result.created ? 201 : 200).send(result);
}

export async function registerBarber(req: Request, res: Response) {
  const { error } = RegisterBarberSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = req.user!.barbershopId;

  const result = await registerBarberService({
    barbershopId,
    ...req.body,
  });

  return res.status(201).send(result);
}

export async function registerSuperAdmin(req: Request, res: Response) {
  const { error } = RegisterSuperAdminSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await registerSuperAdminService(req.body);
  return res.status(201).send(result);
}

export async function me(req: Request, res: Response) {
  const result = await meService(req.user!.id);
  return res.status(200).send(result);
}

export async function refresh(req: Request, res: Response) {
  const { error } = RefreshTokenSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await refreshTokenService(req.body.refreshToken);
  return res.status(200).send(result);
}

export async function switchBarbershop(req: Request, res: Response) {
  const barbershopId = String(req.body?.barbershopId || "").trim();
  if (!barbershopId) {
    return res.status(422).send(["Barbearia inválida"]);
  }

  const result = await switchBarbershopService({
    userId: req.user!.id,
    barbershopId,
  });

  return res.status(200).send(result);
}

export async function logout(_req: Request, res: Response) {
  // Sem blacklist/Redis por ora — o frontend descarta os tokens localmente.
  // Quando houver Redis, invalidar o refresh token aqui.
  return res.status(200).send({ message: "Logout realizado com sucesso" });
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await forgotPasswordService(req.body);
  return res.status(200).send(result);
}

export async function resetPassword(req: Request, res: Response) {
  const result = await resetPasswordService(req.body);
  return res.status(200).send(result);
}
