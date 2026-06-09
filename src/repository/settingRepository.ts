import prisma from "../database/database.js";
import type { Prisma } from "@prisma/client";

export function getSettingsByBarbershop(barbershopId: string) {
    return prisma.barbershop_settings.findUnique({
        where: { barbershop_id: barbershopId },
    });
}

const barbershopProfileSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    cnpj: true,
    logo_url: true,
    slug: true,
    pagarme_recipient_id: true,
    pagarme_recipient_status: true,
    created_at: true,
    platform_subscription_status: true,
};

export function getBarbershopProfileById(barbershopId: string) {
    return prisma.barbershops.findUnique({
        where: { id: barbershopId },
        select: barbershopProfileSelect,
    });
}

export function updateBarbershopProfileById(
    barbershopId: string,
    data: {
        name?: string;
        email?: string | null;
        phone?: string | null;
        cnpj?: string | null;
        logo_url?: string | null;
    },
) {
    return prisma.barbershops.update({
        where: { id: barbershopId },
        data,
        select: barbershopProfileSelect,
    });
}

export function upsertSettingsByBarbershop(
    barbershopId: string,
    data: {
        pix_key?: string | null;
        terms_document_url?: string | null;
        terms_document_name?: string | null;
        hidden_booking_payment_methods?: string[] | null;
    }
) {
    return prisma.barbershop_settings.upsert({
        where: { barbershop_id: barbershopId },
        update: {
            pix_key: data.pix_key ?? null,
            terms_document_url: data.terms_document_url ?? null,
            terms_document_name: data.terms_document_name ?? null,
            hidden_booking_payment_methods: data.hidden_booking_payment_methods ?? [],
        },
        create: {
            barbershop_id: barbershopId,
            pix_key: data.pix_key ?? null,
            terms_document_url: data.terms_document_url ?? null,
            terms_document_name: data.terms_document_name ?? null,
            hidden_booking_payment_methods: data.hidden_booking_payment_methods ?? [],
        },
    });
}

export function getHomeInfoByBarbershop(barbershopId: string) {
    return prisma.barbershop_home_info.findUnique({
        where: { barbershop_id: barbershopId },
    });
}

export function upsertHomeInfoByBarbershop(
    barbershopId: string,
    data: Prisma.barbershop_home_infoUncheckedCreateInput
) {
    // como barbershop_id é unique, dá pra upsert por ele
    return prisma.barbershop_home_info.upsert({
        where: { barbershop_id: barbershopId },
        update: {
            hero_title: data.hero_title ?? null,
            hero_subtitle: data.hero_subtitle ?? null,
            hero_image: data.hero_image ?? null,
            hero_images: data.hero_images ?? [],
            about_title: data.about_title ?? null,
            about_text1: data.about_text1 ?? null,
            about_text2: data.about_text2 ?? null,
            about_text3: data.about_text3 ?? null,
            schedule_title: data.schedule_title ?? null,
            schedule_line1: data.schedule_line1 ?? null,
            schedule_line2: data.schedule_line2 ?? null,
            schedule_line3: data.schedule_line3 ?? null,
            barber_payment_frequency: data.barber_payment_frequency ?? null,
            employee_payment_frequency: data.employee_payment_frequency ?? null,
            whatsapp_number: data.whatsapp_number ?? null,
            location_title: data.location_title ?? null,
            location_address: data.location_address ?? null,
            location_city: data.location_city ?? null,
        },
        create: {
            barbershop_id: barbershopId,
            hero_title: data.hero_title ?? null,
            hero_subtitle: data.hero_subtitle ?? null,
            hero_image: data.hero_image ?? null,
            hero_images: data.hero_images ?? [],
            about_title: data.about_title ?? null,
            about_text1: data.about_text1 ?? null,
            about_text2: data.about_text2 ?? null,
            about_text3: data.about_text3 ?? null,
            schedule_title: data.schedule_title ?? null,
            schedule_line1: data.schedule_line1 ?? null,
            schedule_line2: data.schedule_line2 ?? null,
            schedule_line3: data.schedule_line3 ?? null,
            barber_payment_frequency: data.barber_payment_frequency ?? null,
            employee_payment_frequency: data.employee_payment_frequency ?? null,
            whatsapp_number: data.whatsapp_number ?? null,
            location_title: data.location_title ?? null,
            location_address: data.location_address ?? null,
            location_city: data.location_city ?? null,
        },
    });
}
