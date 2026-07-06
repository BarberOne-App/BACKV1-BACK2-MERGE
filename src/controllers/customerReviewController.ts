import { Request, Response } from "express";
import Joi from "joi";
import {
  createCustomerReviewService,
  listCustomerReviewsService,
} from "../services/customerReviewService.js";

const CreateReviewSchema = Joi.object({
  appointmentId: Joi.string().uuid().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().allow("", null).max(1000).optional(),
});

const ListReviewsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(200),
});

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados invalidos"];
}

export async function createCustomerReview(req: Request, res: Response) {
  const { error, value } = CreateReviewSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await createCustomerReviewService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorPermissions: req.user!.permissions,
    data: {
      appointmentId: value.appointmentId,
      rating: value.rating,
      comment: value.comment ?? null,
    },
  });

  return res.status(201).send(result);
}

export async function listCustomerReviews(req: Request, res: Response) {
  const { error, value } = ListReviewsSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await listCustomerReviewsService({
    barbershopId: req.user!.barbershopId,
    actorId: req.user!.id,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorPermissions: req.user!.permissions,
    limit: value.limit,
  });

  return res.status(200).send(result);
}
