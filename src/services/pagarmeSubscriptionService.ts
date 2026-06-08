// services/pagarmeSubscriptionService.ts
import crypto from 'crypto';
import prisma from '../database/database.js';
import { findActiveSubscriptionByUser } from '../repository/subscriptionRepository.js';
import { pagarmeRequest } from './pagarmeApi.js';

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

    const barbershopId =
        params.barbershopId ||
        plan.barbershop_id ||
        currentUser?.barbershopId;

    if (!barbershopId) {
        throw new Error('Barbearia não identificada para criar a assinatura.');
    }

    const shop = await prisma.barbershops.findUnique({
        where: { id: String(barbershopId) },
        select: {
            id: true,
            pagarme_recipient_id: true,
        },
    });

    if (!shop?.pagarme_recipient_id) {
        throw new Error('A barbearia ainda não possui recipient_id do Pagar.me.');
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
        },
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
        },
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
        pagarme_recipient_id: shop.pagarme_recipient_id,
        status: pagarmeSubscription.status || 'active',
        payment_method: 'credito' as any,
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
