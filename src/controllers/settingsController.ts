import type { Request, Response } from "express";
import {
    getBarbershopProfileService,
    getSettingsService,
    updateBarbershopProfileService,
    upsertSettingsService,
    getHomeInfoService,
    upsertHomeInfoService,
} from "../services/settingService.js";

export async function getBarbershopProfile(req: Request, res: Response) {
    const barbershopId = (req.query.barbershopId as string) || req.user!.barbershopId;
    const result = await getBarbershopProfileService(barbershopId);
    return res.status(200).send(result);
}

export async function updateBarbershopProfile(req: Request, res: Response) {
    const result = await updateBarbershopProfileService({
        barbershopId: req.user!.barbershopId,
        data: {
            name: req.body?.name,
            email: req.body?.email,
            phone: req.body?.phone,
            cnpj: req.body?.cnpj,
            logoUrl: req.body?.logoUrl,
            googleMapsUrl: req.body?.googleMapsUrl,
        },
    });

    return res.status(200).send(result);
}

export async function getSettings(req: Request, res: Response) {
    const result = await getSettingsService(req.user!.barbershopId);
    return res.status(200).send(result);
}

export async function upsertSettings(req: Request, res: Response) {
    const result = await upsertSettingsService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role as "admin" | "barber" | "client" | "receptionist",
        pixKey: req.body?.pixKey,
        termsDocumentUrl: req.body?.termsDocumentUrl,
        termsDocumentName: req.body?.termsDocumentName,
        hiddenBookingPaymentMethods: req.body?.hiddenBookingPaymentMethods,
        subscriptionBarberRule: req.body?.subscriptionBarberRule,
        commissionRuleType: req.body?.commissionRuleType ?? req.body?.commission_rule_type,
    });
    return res.status(200).send(result);
}

export async function getHomeInfo(req: Request, res: Response) {
    const result = await getHomeInfoService(req.user!.barbershopId);
    return res.status(200).send(result);
}

export async function upsertHomeInfo(req: Request, res: Response) {
    const result = await upsertHomeInfoService({
        barbershopId: req.user!.barbershopId,
        actorRole: req.user!.role as "admin" | "barber" | "client",
        data: req.body,
    });
    return res.status(200).send(result);
}
