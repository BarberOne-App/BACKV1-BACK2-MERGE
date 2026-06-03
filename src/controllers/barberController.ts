import { Request, Response } from "express";
import {
  BarberIdParamSchema,
  CreateBarberSchema,
  LinkUserSchema,
  ListBarbersQuerySchema,
  UpdateBarberSchema,
} from "../models/barberSchemas.js";
import {
  createBarberService,
  deleteBarberService,
  getBarberByIdService,
  getMyBarberService,
  linkBarberToUserService,
  listBarbersService,
  updateBarberService,
} from "../services/barberService.js";
import { validatePlanUserLimit } from "../services/planLimitService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function listBarbers(req: Request, res: Response) {
  const { error, value } = ListBarbersQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listBarbersService({
    barbershopId: req.user!.barbershopId,
    query: { q: value.q, page: value.page, limit: value.limit },
  });

  return res.status(200).send(result);
}

export async function getBarberById(req: Request, res: Response) {
  const { error } = BarberIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getBarberByIdService({
    barbershopId: req.user!.barbershopId,
    barberId: req.params.id,
  });

  return res.status(200).send(result);
}

export async function createBarber(req: Request, res: Response) {
  const { error } = CreateBarberSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  // ✅ Validar limite de barbeiros por plano antes de criar
  await validatePlanUserLimit(req.user!.barbershopId, "barber");

  const result = await createBarberService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    data: req.body,
  });

  return res.status(201).send(result);
}

export async function updateBarber(req: Request, res: Response) {
  const p = BarberIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdateBarberSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updateBarberService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    barberId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

export async function linkUser(req: Request, res: Response) {
  const p = BarberIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = LinkUserSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await linkBarberToUserService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    barberId: req.params.id,
    userId: b.value.userId,
  });

  return res.status(200).send(result);
}

export async function getMyBarber(req: Request, res: Response) {
  const result = await getMyBarberService({
    barbershopId: req.user!.barbershopId,
    userId: req.user!.id,
  });

  return res.status(200).send(result);
}

export async function deleteBarber(req: Request, res: Response) {
  const { error } = BarberIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await deleteBarberService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    barberId: req.params.id,
  });

  return res.status(200).send(result);
}
