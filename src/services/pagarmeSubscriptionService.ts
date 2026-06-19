// services/pagarmeSubscriptionService.ts
import crypto from 'crypto';
import prisma from '../database/database.js';
import { findActiveSubscriptionByUser } from '../repository/subscriptionRepository.js';
import { pagarmeRequest } from './pagarmeApi.js';
import { createPagarmeOrderService, getPagarmeOrderStatusService, normalizePagarmeOrder } from './pagarmeOrderService.js';

function onlyNumbers(value: any) {
    return String(value || '').replace(/\D/g, '');
}

function toCents(value: any) {
    return Math.round(Number(value || 0) * 100);
}

function extractPhone(phone: any) {
    const digits = onlyNumbers(phone);

    if (digits.length < 10) {
        return {
            country_code: '55',
            area_code: '11',
            number: '999999999',
        };
    }

    const withoutCountry = digits.startsWith('55') && digits.length > 11
        ? digits.slice(2)
        : digits;

    return {
        country_code: '55',
        area_code: withoutCountry.slice(0, 2),
        number: withoutCountry.slice(2),
    };
}

async function ensurePagarmePlan(plan: any) {
    if (plan.pagarme_plan_id) {
        return plan.pagarme_plan_id;
    }

    const amountInCents = toCents(plan.price);

    const payload = {
        name: plan.name,
        description: plan.description || `Plano ${plan.name}`,
        currency: 'BRL',
        interval: 'month',
        interval_count: 1,
        billing_type: 'prepaid',
        payment_methods: ['credit_card'],
        installments: [1],
        items: [
            {
                name: plan.name,
                quantity: 1,
                pricing_scheme: {
                    price: amountInCents,
                },
            },
        ],
        metadata: {
            localPlanId: String(plan.id),
            barbershopId: String(plan.barbershop_id || ''),
            type: 'client_barbershop_plan',
        },
    };

    const pagarmePlan = await pagarmeRequest('/plans', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    await prisma.subscription_plans.update({
        where: { id: String(plan.id) },
        data: { pagarme_plan_id: pagarmePlan.id },
    });

    return pagarmePlan.id;
}

export async function createPagarmeClientSubscriptionService(params: any, currentUser: any) {
    const plan = await prisma.subscription_plans.findUnique({
        where: { id: String(params.planId) },
    });

    if (!plan) {
        throw new Error('Plano não encontrado.');
    }

    const configuredPaymentMethod = String((plan as any).payment_method || '');
    if (configuredPaymentMethod !== 'credito' && configuredPaymentMethod !== 'debito') {
        throw new Error('Este plano nao esta configurado para pagamento no cartao.');
    }

    const barbershopId =
        params.barbershopId ||
        plan.barbershop_id ||
        currentUser?.barbershopId;

    if (!barbershopId) {
        throw new Error('Barbearia não identificada para criar a assinatura.');
    }

    if (String(plan.barbershop_id) !== String(barbershopId)) {
        throw new Error('O plano informado nao pertence a esta barbearia.');
    }

    const shop = await prisma.barbershops.findUnique({
        where: { id: String(barbershopId) },
        select: {
            id: true,
            pagarme_recipient_id: true,
        },
    });

    let useSplit = false;
    if (shop?.pagarme_recipient_id) {
        try {
            const recipient = await pagarmeRequest(`/recipients/${encodeURIComponent(shop.pagarme_recipient_id)}`, {
                method: 'GET',
            });
            const recipientStatus = String(recipient?.status || '').toLowerCase();
            const allowedRecipientStatuses = new Set(['registration', 'affiliation', 'active']);
            if (allowedRecipientStatuses.has(recipientStatus)) {
                useSplit = true;
            } else {
                console.warn(`[Pagar.me] Recebedor ${shop.pagarme_recipient_id} está inativo (status: ${recipientStatus}). A transação prosseguirá sem divisão de valores.`);
            }
        } catch (error: any) {
            console.warn(`[Pagar.me] Recebedor ${shop.pagarme_recipient_id} não pôde ser validado (erro: ${error?.message || error}). A transação prosseguirá sem divisão de valores.`);
        }
    } else {
        console.warn(`[Pagar.me] Barbearia ${barbershopId} sem pagarme_recipient_id. A transação prosseguirá sem divisão de valores.`);
    }

    if (!params.cardToken) {
        throw new Error('cardToken é obrigatório para assinatura no cartão.');
    }

    const currentUserId = String(currentUser?.id || params.userId || '');

    // Busca qualquer assinatura existente do usuário (para upsert)
    const existingSubscription = currentUserId
        ? await prisma.subscriptions.findFirst({
            where: { user_id: currentUserId, barbershop_id: String(barbershopId) },
            select: { id: true, pagarme_subscription_id: true, status: true },
        })
        : null;

    // Cancela a assinatura anterior no Pagar.me se existir
    if (existingSubscription?.pagarme_subscription_id) {
        try {
            await pagarmeRequest(
                `/subscriptions/${existingSubscription.pagarme_subscription_id}/cancel`,
                { method: 'DELETE' },
            );
        } catch {
            // Ignora erro de cancelamento — pode já estar cancelada no Pagar.me
        }
    }

    const pagarmePlanId = await ensurePagarmePlan(plan);

    const customerPhone = extractPhone(params.customer?.phone || currentUser?.phone);

    const payload: any = {
        code: `client_sub_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        plan_id: pagarmePlanId,
        payment_method: 'credit_card',
        installments: 1,
        customer: {
            name: params.customer?.name || currentUser?.name || 'Cliente',
            email: params.customer?.email || currentUser?.email,
            type: 'individual',
            document: onlyNumbers(params.customer?.document || currentUser?.cpf || currentUser?.document),
            phones: {
                mobile_phone: customerPhone,
            },
        },
        card_token: params.cardToken,
        metadata: {
            type: 'client_barbershop_subscription',
            userId: String(currentUser?.id || params.userId || ''),
            barbershopId: String(barbershopId),
            planId: String(plan.id),
            planPaymentMethod: configuredPaymentMethod,
        },
        ...(useSplit && shop?.pagarme_recipient_id ? {
            split: {
                enabled: true,
                rules: [
                    {
                        amount: 100,
                        recipient_id: shop.pagarme_recipient_id,
                        type: 'percentage',
                        options: {
                            charge_processing_fee: true,
                            charge_remainder_fee: true,
                            liable: true,
                        },
                    },
                ],
            }
        } : {}),
    };

    const pagarmeSubscription = await pagarmeRequest('/subscriptions', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    const subscriptionData = {
        plan_id: String(plan.id),
        pagarme_subscription_id: pagarmeSubscription.id,
        pagarme_plan_id: pagarmePlanId,
        pagarme_customer_id: pagarmeSubscription.customer?.id || null,
        pagarme_recipient_id: useSplit && shop ? shop.pagarme_recipient_id : null,
        status: pagarmeSubscription.status || 'active',
        payment_method: configuredPaymentMethod as any,
        amount: Number(plan.price),
        next_billing_at: pagarmeSubscription.next_billing_at
            ? new Date(pagarmeSubscription.next_billing_at)
            : null,
        last_billing_at: new Date(),
        ended_at: null,
        days_overdue: 0,
    };

    const subscription = existingSubscription
        ? await prisma.subscriptions.update({
            where: { id: existingSubscription.id },
            data: { ...subscriptionData, updated_at: new Date() },
        })
        : await prisma.subscriptions.create({
            data: {
                user_id: String(currentUser.id),
                barbershop_id: String(barbershopId),
                created_at: new Date(),
                ...subscriptionData,
            },
        });

    return {
        id: subscription.id,
        status: subscription.status,
        pagarmeSubscriptionId: pagarmeSubscription.id,
        pagarmePlanId,
        planId: plan.id,
        planName: plan.name,
        amount: Number(plan.price),
        barbershopId,
        raw: pagarmeSubscription,
    };
}

function isPaidOrder(order: any) {
    const normalized = order?.raw ? order : normalizePagarmeOrder(order);
    return normalized?.status === 'paid' || normalized?.chargeStatus === 'paid';
}

async function activatePaidPixSubscription(params: {
    planId: string;
    orderId: string;
    userId: string;
    barbershopId: string;
}) {
    const plan = await prisma.subscription_plans.findFirst({
        where: { id: params.planId, barbershop_id: params.barbershopId },
    });
    if (!plan) throw new Error('Plano nao encontrado.');
    if ((plan as any).payment_method !== 'pix') {
        throw new Error('Este plano nao esta configurado para pagamento via PIX.');
    }

    const alreadyProcessed = await prisma.payment_transactions.findFirst({
        where: { pagarme_order_id: params.orderId, status: 'paid' },
        select: { subscription_id: true },
    });
    if (alreadyProcessed?.subscription_id) {
        return prisma.subscriptions.findUnique({ where: { id: alreadyProcessed.subscription_id } });
    }

    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const periodEnd = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.subscriptions.findFirst({
            where: { user_id: params.userId, barbershop_id: params.barbershopId },
        });

        const subscription = existing
            ? await tx.subscriptions.update({
                where: { id: existing.id },
                data: {
                    plan_id: plan.id,
                    status: 'active',
                    payment_method: 'pix',
                    amount: plan.price,
                    is_recurring: false,
                    auto_renewal: false,
                    last_billing_at: now,
                    next_billing_at: nextBilling,
                    ended_at: null,
                    days_overdue: 0,
                    overdue_notification_sent: false,
                    updated_at: now,
                },
            })
            : await tx.subscriptions.create({
                data: {
                    user_id: params.userId,
                    barbershop_id: params.barbershopId,
                    plan_id: plan.id,
                    status: 'active',
                    payment_method: 'pix',
                    amount: plan.price,
                    is_recurring: false,
                    auto_renewal: false,
                    started_at: now,
                    last_billing_at: now,
                    next_billing_at: nextBilling,
                    created_at: now,
                },
            });

        await tx.subscription_cycles.upsert({
            where: {
                subscription_id_period_start_period_end: {
                    subscription_id: subscription.id,
                    period_start: periodStart,
                    period_end: periodEnd,
                },
            },
            create: {
                subscription_id: subscription.id,
                period_start: periodStart,
                period_end: periodEnd,
                cuts_included: plan.cuts_per_month,
                cuts_used: 0,
            },
            update: {
                cuts_included: plan.cuts_per_month,
                cuts_used: 0,
            },
        });

        await tx.payment_transactions.create({
            data: {
                user_id: params.userId,
                subscription_id: subscription.id,
                barbershop_id: params.barbershopId,
                amount: plan.price,
                method: 'pix',
                status: 'paid',
                paid_at: now,
                pagarme_order_id: params.orderId,
                pagarme_status: 'paid',
            },
        });

        return subscription;
    });
}

export async function createPagarmeClientPixOrderService(params: any, currentUser: any): Promise<any> {
    const barbershopId = String(currentUser?.barbershopId || '');
    const userId = String(currentUser?.id || '');
    const plan = await prisma.subscription_plans.findFirst({
        where: { id: String(params.planId), barbershop_id: barbershopId, active: true },
    });
    if (!plan) throw new Error('Plano nao encontrado ou inativo.');
    if ((plan as any).payment_method !== 'pix') {
        throw new Error('A forma de pagamento deste plano nao e PIX.');
    }

    return createPagarmeOrderService({
        amount: Number(plan.price),
        paymentMethod: 'pix',
        customer: {
            id: userId,
            name: currentUser?.name,
            email: currentUser?.email,
            document: params.customer?.document,
            phone: params.customer?.phone,
        },
        item: { id: plan.id, name: `Assinatura - ${plan.name}` },
        metadata: {
            type: 'client_subscription_pix',
            userId,
            barbershopId,
            planId: plan.id,
        },
    });
}

export async function confirmPagarmeClientPixOrderService(params: any, currentUser: any) {
    const order = await getPagarmeOrderStatusService(String(params.orderId));
    const metadata = (order.raw as any)?.metadata || {};
    const userId = String(currentUser?.id || '');
    const barbershopId = String(currentUser?.barbershopId || '');

    if (
        metadata.type !== 'client_subscription_pix' ||
        String(metadata.userId) !== userId ||
        String(metadata.barbershopId) !== barbershopId ||
        String(metadata.planId) !== String(params.planId)
    ) {
        throw new Error('Pagamento PIX nao pertence a esta assinatura.');
    }
    if (!isPaidOrder(order)) {
        return { paid: false, status: order.status, chargeStatus: order.chargeStatus };
    }

    const subscription = await activatePaidPixSubscription({
        planId: String(params.planId),
        orderId: String(params.orderId),
        userId,
        barbershopId,
    });
    return { paid: true, subscription };
}

export async function syncClientPixSubscriptionWebhook(order: any, metadata: any) {
    if (String(metadata?.type || '') !== 'client_subscription_pix' || !isPaidOrder(order)) {
        return { handled: false };
    }
    await activatePaidPixSubscription({
        planId: String(metadata.planId),
        orderId: String(order?.id || ''),
        userId: String(metadata.userId),
        barbershopId: String(metadata.barbershopId),
    });
    return { handled: true };
}
