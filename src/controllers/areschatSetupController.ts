import { Request, Response } from "express";
import {
  generateAresChatSetupDataService,
  getAresChatSetupDataService,
} from "../services/areschatSetupService.js";

export async function getAresChatSetupData(req: Request, res: Response) {
  const result = await getAresChatSetupDataService({
    user: req.user!,
    barbershopId: String(req.query.barbershopId || "").trim() || null,
  });

  return res.status(200).send(result);
}

export async function generateAresChatSetupData(req: Request, res: Response) {
  const result = await generateAresChatSetupDataService({
    user: req.user!,
    barbershopId: String(req.body?.barbershopId || "").trim() || null,
    name: String(req.body?.name || "").trim() || null,
  });

  return res.status(201).send(result);
}
