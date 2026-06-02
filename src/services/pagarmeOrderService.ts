import crypto from 'crypto';
import prisma from '../database/database.js';
import { pagarmeRequest } from './pagarmeApi.js';

interface PhoneData {
    country_code: string;
    area_code: string;
    number: string;
}

interface SplitOptions {
    liable: boolean;
    charge_processing_fee: boolean;
    charge_remainder_fee: boolean;
}

interface SplitItem {
    amount: number;
    recipient_id: string;
    type: 'flat';
    options: SplitOptions;
}

interface BuildSplitParams {
    amountInCents: number;
    barbershopRecipientId: string;
    platformFeeAmountInCents: number;
}

interface Card {
    brand?: string;
    last_four_digits?: string;
    last_digits?: string;
}

interface Transaction {
    card?: Card;
    qr_code?: string;
    qr_code_url?: string;
    qr_code_url_png?: string;
}

interface Charge {
    id?: string;
    status?: string;
    payment_method?: string;
    amount?: number;
    card?: Card;
    last_transaction?: Transaction;
}

interface PagarmeOrder {
    id?: string;
    code?: string;
    status?: string;
    amount?: number;
    charges?: Charge[];
}

interface NormalizedOrder {
    orderId?: string;
    orderCode?: string;
    status?: string;
    chargeId?: string;
    chargeStatus?: string;
    amount: number;
    paymentMethod?: string;
    pixQrCode: string;
    pixQrCodeUrl: string;
    cardBrand: string;
    cardLastDigits: string;
    raw: PagarmeOrder;
}

function onlyNumbers(value: string | number | undefined | null): string {
    return String(value || '').replace(/\D/g, '');
}

function toCents(value: string | number | undefined | null): number {
    return Math.round(Number(value || 0) * 100);
}

function extractPhone(phone: string | undefined | null): PhoneData | null {
    const digits = onlyNumbers(phone);

    if (digits.length < 10) return null;

    const withoutCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;

    return {
        country_code: '55',
        area_code: withoutCountry.slice(0, 2),
        number: withoutCountry.slice(2),
    };
}

function getPlatformFeeAmount(amountInCents: number, bodyFeeAmount: string | number | undefined | null): number {
    if (bodyFeeAmount !== undefined && bodyFeeAmount !== null && bodyFeeAmount !== '') {
        return Math.max(0, toCents(bodyFeeAmount));
    }

    const percent = Number(process.env.PAGARME_PLATFORM_FEE_PERCENT || 10);
    return Math.round(amountInCents * (percent / 100));
}

function buildSplit({ amountInCents, barbershopRecipientId, platformFeeAmountInCents }: BuildSplitParams): SplitItem[] {
    const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID || null;

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    if (!platformRecipientId || platformFeeAmountInCents <= 0) {
        return [
            {
                amount: amountInCents,
                recipient_id: barbershopRecipientId,
                type: 'flat',
                options: {
                    liable: true,
                    charge_processing_fee: true,
                    charge_remainder_fee: true,
                },
            },
        ];
    }

    const sellerAmount = Math.max(0, amountInCents - platformFeeAmountInCents);

    return [
        {
            amount: sellerAmount,
            recipient_id: barbershopRecipientId,
            type: 'flat',
            options: {
                liable: false,
                charge_processing_fee: false,
                charge_remainder_fee: false,
            },
        },
        {
            amount: platformFeeAmountInCents,
            recipient_id: platformRecipientId,
            type: 'flat',
            options: {
                liable: true,
                charge_processing_fee: true,
                charge_remainder_fee: true,
            },
        },
    ];
}

function normalizePaymentMethod(method: any) {
    const value = String(method || '').trim().toLowerCase();

    if (value === 'pix') return 'pix';

    if (
        value === 'card' ||
        value === 'cartao' ||
        value === 'cartão' ||
        value === 'credit_card' ||
        value === 'creditcard'
    ) {
        return 'credit_card';
    }

    throw new Error(`Método de pagamento inválido: ${method}`);
}

export function normalizePagarmeOrder(order: PagarmeOrder): NormalizedOrder {
    const charge = order?.charges?.[0] || {};
    const lastTransaction = charge?.last_transaction || {};
    const card = lastTransaction?.card || charge?.card || {};

    return {
        orderId: order?.id,
        orderCode: order?.code,
        status: order?.status,
        chargeId: charge?.id,
        chargeStatus: charge?.status,
        amount: Number(order?.amount || charge?.amount || 0) / 100,
        paymentMethod: charge?.payment_method,
        pixQrCode: lastTransaction?.qr_code || '',
        pixQrCodeUrl: lastTransaction?.qr_code_url || lastTransaction?.qr_code_url_png || '',
        cardBrand: card?.brand || '',
        cardLastDigits: card?.last_four_digits || card?.last_digits || '',
        raw: order,
    };
}

export async function createPagarmeOrderService(params: any) {
    console.log("createPagarmeOrderService called with params:", params);
    const amountInCents = toCents(params.amount);

    if (!amountInCents || amountInCents <= 0) {
        throw new Error('Valor do pagamento inválido.');
    }

    const barbershopId = params?.metadata?.barbershopId;

    let barbershopRecipientId: string | null = null;

    if (barbershopId) {
        const shop = await prisma.barbershops.findUnique({
            where: { id: String(barbershopId) },
            select: { pagarme_recipient_id: true },
        });
        barbershopRecipientId = shop?.pagarme_recipient_id || null;
    }

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    const platformFeeAmountInCents = getPlatformFeeAmount(amountInCents, params.platformFeeAmount);

    const customerPhone = extractPhone(params?.customer?.phone);
    const customerDocument = onlyNumbers(params?.customer?.document);

    const customer = {
        name: params?.customer?.name || 'Cliente',
        email: params?.customer?.email,
        type: 'individual',
        document: customerDocument || '00000000000',
        phones: customerPhone
            ? { mobile_phone: customerPhone }
            : { mobile_phone: { country_code: '55', area_code: '11', number: '999999999' } },
    };

    const itemName = params?.item?.name || 'Agendamento';
    const orderCode = `barberone_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const paymentMethod = normalizePaymentMethod(params.paymentMethod);

    const payment: any = {
        payment_method: paymentMethod,
        split: buildSplit({
            amountInCents,
            barbershopRecipientId,
            platformFeeAmountInCents,
        }),
    };

    if (payment.payment_method === 'pix') {
        payment.pix = {
            expires_in: Number(process.env.PAGARME_PIX_EXPIRES_IN || 3600),
        };
    } else {
        if (!params.cardToken) {
            throw new Error('cardToken é obrigatório para pagamento com cartão.');
        }

        const billingAddress = {
            line_1: '123, Rua Teste, Centro',
            line_2: 'Casa',
            zip_code: '01001000',
            city: 'Sao Paulo',
            state: 'SP',
            country: 'BR',
        };

        payment.credit_card = {
            operation_type: 'auth_and_capture',
            installments: 1,
            statement_descriptor: 'BarberOne',
            card_token: params.cardToken,
            card: {
                billing_address: billingAddress,
            },
        };
    }

    const payload = {
        code: orderCode,
        closed: true,
        customer,
        items: [
            {
                amount: amountInCents,
                description: itemName,
                quantity: 1,
                code: '1234',
            },
        ],
        payments: [payment],
        metadata: params.metadata || {},
    };

    const order = await pagarmeRequest('/orders', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    console.log('Pagarme order created:', order);
    return order;
}

export async function getPagarmeOrderStatusService(orderId: string) {
    const order = await pagarmeRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
    });

    return normalizePagarmeOrder(order);
}

function buildRecipientPayload(params: any) {
    return {
        register_information: params.register_information,
        default_bank_account: params.default_bank_account,
        transfer_settings: params.transfer_settings || {
            transfer_enabled: true,
            transfer_interval: 'daily',
            transfer_day: 0,
        },
        metadata: {
            barbershopId: String(params.barbershopId || ''),
            ...(params.metadata || {}),
        },
        code: params.code || `barbershop_${params.barbershopId || crypto.randomUUID()}`,
    };
}

async function linkRecipientToBarbershop(barbershopId: string, recipientId: string, status: string | null) {
    const exists = await prisma.barbershops.findUnique({
        where: { id: String(barbershopId) },
        select: { id: true },
    });
    if (exists) {
        await prisma.barbershops.update({
            where: { id: String(barbershopId) },
            data: {
                pagarme_recipient_id: recipientId,
                pagarme_recipient_status: status || null,
            },
        });
    }
}

export async function createPagarmeRecipientService(params: any) {
    const payload = buildRecipientPayload(params);

    const recipient = await pagarmeRequest('/recipients', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
    });

    if (params.linkBarbershop && params.barbershopId && recipient?.id) {
        await linkRecipientToBarbershop(params.barbershopId, recipient.id, recipient.status ?? null);
    }

    return recipient;
}

export async function getPagarmeRecipientService(recipientId: string) {
    if (!recipientId) throw new Error('Recipient ID é obrigatório.');
    return pagarmeRequest(`/recipients/${encodeURIComponent(recipientId)}`, { method: 'GET' });
}

export async function updatePagarmeRecipientService(params: any) {
    const recipientId = String(params.recipientId || params.id || '').trim();
    if (!recipientId) throw new Error('Recipient ID é obrigatório para atualização.');

    const payload = buildRecipientPayload(params);

    const recipient = await pagarmeRequest(`/recipients/${encodeURIComponent(recipientId)}`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
    });

    if (params.linkBarbershop && params.barbershopId && recipient?.id) {
        await linkRecipientToBarbershop(params.barbershopId, recipient.id, recipient.status ?? null);
    }

    return recipient;
}
