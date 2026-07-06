import { Request, Response } from "express";
import {
  CreateSubscriptionSchema,
  ListSubscriptionsQuerySchema,
  SubscriptionIdParamSchema,
  UpdateSubscriptionSchema,
} from "../models/subscriptionSchemas.js";
import {
  cancelSubscriptionService,
  checkOverdueService,
  createSubscriptionService,
  getSubscriptionByIdService,
  listSubscriptionsService,
  renewSubscriptionService,
  toggleRecurringService,
  updateSubscriptionService,
} from "../services/subscriptionService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listSubscriptions(req: Request, res: Response) {
  const { error, value } = ListSubscriptionsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listSubscriptionsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      userId: value.userId,
      status: value.status,
      search: value.search,
      searchType: value.searchType,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

/* ───── GET BY ID ───── */
export async function getSubscriptionById(req: Request, res: Response) {
  const { error } = SubscriptionIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getSubscriptionByIdService({
    barbershopId: req.user!.barbershopId,
    subscriptionId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createSubscription(req: Request, res: Response) {
  const { error, value } = CreateSubscriptionSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createSubscriptionService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    actorRole: req.user!.role,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updateSubscription(req: Request, res: Response) {
  const p = SubscriptionIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdateSubscriptionSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updateSubscriptionService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorPermissions: req.user!.permissions,
    subscriptionId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

/* ───── CANCEL ───── */
export async function cancelSubscription(req: Request, res: Response) {
  const { error } = SubscriptionIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await cancelSubscriptionService({
    barbershopId: req.user!.barbershopId,
    subscriptionId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── RENEW ───── */
export async function renewSubscription(req: Request, res: Response) {
  const { error } = SubscriptionIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await renewSubscriptionService({
    barbershopId: req.user!.barbershopId,
    subscriptionId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── TOGGLE RECURRING ───── */
export async function toggleRecurring(req: Request, res: Response) {
  const { error } = SubscriptionIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await toggleRecurringService({
    barbershopId: req.user!.barbershopId,
    subscriptionId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── CHECK OVERDUE (job endpoint) ───── */
export async function checkOverdue(req: Request, res: Response) {
  const result = await checkOverdueService({
    barbershopId: req.user!.barbershopId,
  });

  return res.status(200).send(result);
}
