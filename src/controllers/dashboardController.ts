import { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboardService.js";

export async function getDashboard(req: Request, res: Response) {
  const result = await getDashboardStats(req.user!.barbershopId);
  return res.status(200).json(result);
}
