import type { Request, Response } from "express";
import type { ValidationError } from "joi";
import { CreateLandingLeadSchema, LandingLeadIdParamSchema, ListLandingLeadsQuerySchema, UpdateLandingLeadSchema } from "../models/landingLeadSchemas.js";
import { createLandingLead, getLandingLead, listLandingLeads, updateLandingLead } from "../services/landingLeadService.js";
const errors = (error: ValidationError) => ({ message: "Verifique os dados informados.", errors: error.details.map((item) => item.message) });
export async function createPublicLandingLead(req: Request, res: Response) { const { error, value } = CreateLandingLeadSchema.validate(req.body); if (error) return res.status(422).send(errors(error)); return res.status(201).send({ message: "Contato salvo com sucesso.", lead: await createLandingLead(value) }); }
export async function listSuperAdminLandingLeads(req: Request, res: Response) { const { error, value } = ListLandingLeadsQuerySchema.validate(req.query); if (error) return res.status(422).send(errors(error)); return res.status(200).send(await listLandingLeads(value)); }
export async function getSuperAdminLandingLead(req: Request, res: Response) { const { error } = LandingLeadIdParamSchema.validate(req.params); if (error) return res.status(422).send(errors(error)); return res.status(200).send(await getLandingLead(req.params.id)); }
export async function patchSuperAdminLandingLead(req: Request, res: Response) { const params = LandingLeadIdParamSchema.validate(req.params); if (params.error) return res.status(422).send(errors(params.error)); const body = UpdateLandingLeadSchema.validate(req.body); if (body.error) return res.status(422).send(errors(body.error)); return res.status(200).send(await updateLandingLead(req.params.id, body.value)); }
