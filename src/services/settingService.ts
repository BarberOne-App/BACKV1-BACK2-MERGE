import { badRequest, forbidden, notFound } from "../errors/index.js";
import {
    getBarbershopProfileById,
    getSettingsByBarbershop,
    upsertSettingsByBarbershop,
    getHomeInfoByBarbershop,
    upsertHomeInfoByBarbershop,
    updateBarbershopProfileById,
} from "../repository/settingRepository.js";
import { expirePlatformSubscription } from "./subscriptionExpirationService.js";

type PayrollFrequency = "weekly" | "biweekly" | "monthly";

function normalizeHiddenBookingPaymentMethods(value: unknown) {
    if (!Array.isArray(value)) return [];

    const normalized = value
        .map((item) => String(item || "").trim().toLowerCase())
        .flatMap((item) => {
            if (item === "online") return ["cartao", "pix"];
            return item;
        })
        .filter((item) => item === "cartao" || item === "pix" || item === "local");

    return Array.from(new Set(normalized));
}

function normalizeHeroImages(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    return Array.from(
        new Set(
            value
                .map((item) => String(item || "").trim())
                .filter((item) => item.length > 0),
        ),
    );
}

function normalizePayrollFrequency(value: unknown): PayrollFrequency | null {
    const normalized = String(value || "").trim().toLowerCase();

    if (
        normalized === "weekly" ||
        normalized === "semanal"
    ) {
        return "weekly";
    }

    if (
        normalized === "biweekly" ||
        normalized === "quinzenal"
    ) {
        return "biweekly";
    }

    if (
        normalized === "monthly" ||
        normalized === "mensal"
    ) {
        return "monthly";
    }

    return null;
}

function getDefaultHomeInfo() {
    return {
        hero_title: "",
        hero_subtitle: "",
        hero_image: "",
        hero_images: [],
        about_title: "Barbearia Rodrigues",
        about_text1: "A Barbearia Rodrigues é referência em cortes masculinos há mais de 10 anos.",
        about_text2: "Combinamos técnicas tradicionais com tendências modernas para garantir o melhor atendimento.",
        about_text3: "Nosso ambiente proporciona conforto e uma experiência única.",
        schedule_title: "Horário de Funcionamento",
        schedule_line1: "Seg - 14h as 20h",
        schedule_line2: "Terça a Sab. - 09h as 20h",
        schedule_line3: "Domingo: Fechado",
        whatsapp_number: "",
        location_title: "Localização",
        location_address: "Av. val paraíso,1396",
        location_city: "Jangurussu - Fortaleza/CE",
        barber_payment_frequency: null,
        employee_payment_frequency: null,
    };
}

function mapBarbershopProfile(row: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    cnpj: string | null;
    logo_url: string | null;
    slug: string;
    pagarme_recipient_id?: string | null;
    pagarme_recipient_status?: string | null;
    created_at?: Date | string | null;
    platform_subscription_status?: string | null;
}) {
    return {
        id: row.id,
        name: row.name,
        email: row.email ?? "",
        phone: row.phone ?? "",
        cnpj: row.cnpj ?? "",
        logoUrl: row.logo_url ?? "",
        slug: row.slug,
        pagarmeRecipientId: row.pagarme_recipient_id ?? null,
        pagarmeRecipientStatus: row.pagarme_recipient_status ?? null,
        createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : null,
        platformSubscriptionStatus: row.platform_subscription_status ?? null,
    };
}

export async function getBarbershopProfileService(barbershopId: string) {
    if (!String(barbershopId || "").trim()) {
        throw badRequest("Barbearia ativa nao encontrada");
    }

    await expirePlatformSubscription(barbershopId);
    const row = await getBarbershopProfileById(barbershopId);

    if (!row) {
        throw notFound("Barbearia nao encontrada");
    }

    return mapBarbershopProfile(row);
}

export async function updateBarbershopProfileService(params: {
    barbershopId: string;
    data: {
        name?: unknown;
        email?: unknown;
        phone?: unknown;
        cnpj?: unknown;
        logoUrl?: unknown;
    };
}) {
    if (!String(params.barbershopId || "").trim()) {
        throw badRequest("Barbearia ativa nao encontrada");
    }

    const name = String(params.data?.name ?? "").trim();

    if (!name) {
        throw badRequest("Nome da barbearia e obrigatorio");
    }

    const updateData = {
        name,
        email: String(params.data?.email ?? "").trim() || null,
        phone: String(params.data?.phone ?? "").trim() || null,
        cnpj: String(params.data?.cnpj ?? "").trim() || null,
    } as {
        name: string;
        email: string | null;
        phone: string | null;
        cnpj: string | null;
        logo_url?: string | null;
    };

    if (Object.prototype.hasOwnProperty.call(params.data, "logoUrl")) {
        updateData.logo_url = String(params.data?.logoUrl ?? "").trim() || null;
    }

    const row = await updateBarbershopProfileById(params.barbershopId, updateData);

    return mapBarbershopProfile(row);
}

export async function getSettingsService(barbershopId: string) {
    const row = await getSettingsByBarbershop(barbershopId);
    const hiddenBookingPaymentMethods = normalizeHiddenBookingPaymentMethods(
        (row as any)?.hidden_booking_payment_methods,
    );

    return {
        pixKey: row?.pix_key ?? "",
        termsDocumentUrl: row?.terms_document_url ?? "",
        termsDocumentName: row?.terms_document_name ?? "",
        hiddenBookingPaymentMethods,
    };
}

export async function upsertSettingsService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client" | "receptionist";
    pixKey?: string;
    termsDocumentUrl?: string;
    termsDocumentName?: string;
    hiddenBookingPaymentMethods?: string[];
}) {
    if (params.actorRole !== "admin") {
        throw forbidden("Apenas admin pode alterar configurações");
    }

    const hiddenBookingPaymentMethods = normalizeHiddenBookingPaymentMethods(
        params.hiddenBookingPaymentMethods,
    );

    const row = await upsertSettingsByBarbershop(params.barbershopId, {
        pix_key: params.pixKey ?? "",
        terms_document_url: params.termsDocumentUrl ?? null,
        terms_document_name: params.termsDocumentName ?? null,
        hidden_booking_payment_methods: hiddenBookingPaymentMethods,
    });

    return {
        pixKey: row.pix_key ?? "",
        termsDocumentUrl: row.terms_document_url ?? "",
        termsDocumentName: row.terms_document_name ?? "",
        hiddenBookingPaymentMethods: normalizeHiddenBookingPaymentMethods(
            (row as any)?.hidden_booking_payment_methods,
        ),
    };
}

export async function getHomeInfoService(barbershopId: string) {
    if (!String(barbershopId || "").trim()) {
        return getDefaultHomeInfo();
    }

    const row = await getHomeInfoByBarbershop(barbershopId);

    if (row) {
        const heroImages = normalizeHeroImages((row as any)?.hero_images);

        return {
            ...row,
            hero_images: heroImages,
            barber_payment_frequency:
                normalizePayrollFrequency((row as any)?.barber_payment_frequency) ?? null,
            employee_payment_frequency:
                normalizePayrollFrequency((row as any)?.employee_payment_frequency) ?? null,
        };
    }

    return getDefaultHomeInfo();
}

export async function upsertHomeInfoService(params: {
    barbershopId: string;
    actorRole: "admin" | "barber" | "client" | "receptionist";
    data: any;
}) {
    if (params.actorRole !== "admin") {
        throw forbidden("Apenas admin pode alterar home-info");
    }

    const existing = await getHomeInfoByBarbershop(params.barbershopId);
    const baseData = existing ?? getDefaultHomeInfo();
    const mergedData = {
        ...baseData,
        ...params.data,
    };

    const heroImages = normalizeHeroImages(mergedData?.hero_images);
    const heroImage = String(mergedData?.hero_image || "").trim();

    const barberPaymentFrequency = normalizePayrollFrequency(
        mergedData?.barber_payment_frequency ??
            mergedData?.barberPaymentFrequency,
    );

    const employeePaymentFrequency = normalizePayrollFrequency(
        mergedData?.employee_payment_frequency ??
            mergedData?.employeePaymentFrequency,
    );

    const normalizedData = {
        ...mergedData,
        hero_title: mergedData?.hero_title ?? null,
        hero_subtitle: mergedData?.hero_subtitle ?? null,
        hero_image: heroImage || heroImages[0] || null,
        hero_images: heroImages,
        barber_payment_frequency: barberPaymentFrequency,
        employee_payment_frequency: employeePaymentFrequency,
    };

    delete normalizedData.barberPaymentFrequency;
    delete normalizedData.employeePaymentFrequency;

    return upsertHomeInfoByBarbershop(params.barbershopId, {
        barbershop_id: params.barbershopId,
        ...normalizedData,
    });
}
