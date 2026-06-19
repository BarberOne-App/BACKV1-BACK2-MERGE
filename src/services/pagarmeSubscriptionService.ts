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
        try {
            await pagarmeRequest(`/plans/${plan.pagarme_plan_id}`, { method: 'GET' });
            return plan.pagarme_plan_id;
        } catch (error: any) {
            console.warn(`[Pagar.me] Falha na verificação do plano ${plan.pagarme_plan_id}.`, error?.message || error);
            if (error?.status && error.status !== 404) {
                throw error;
            }
        }
    }

    const amountInCents = toCents(plan.price);

    const payload = {
        name: plan.name || 'Plano Assinatura',
        description: plan.description || `Plano ${plan.name || 'Assinatura'}`,
        currency: 'BRL',
        interval: 'month',
        interval_count: 1,
        billing_type: 'prepaid',
        payment_methods: ['credit_card'],
        installments: [1],
        items: [
            {
                name: plan.name || 'Mensalidade',
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

    const idempotencyKey = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString();

    console.log('PAYLOAD PAGARME (CRIAR PLANO):', JSON.stringify(payload, null, 2));

    let pagarmePlan;
    try {
        pagarmePlan = await pagarmeRequest('/plans', {
            method: 'POST',
            headers: {
                'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(payload),
        });
        console.log('RESPOSTA PAGARME (CRIAR PLANO):', JSON.stringify(pagarmePlan, null, 2));
    } catch (e: any) {
        console.error('ERRO PAGARME (CRIAR PLANO):', e?.message);
        throw e;
    }

    if (!pagarmePlan || !pagarmePlan.id) {
        const err: any = new Error('Falha ao recriar o plano no Pagar.me. Resposta inválida: ' + JSON.stringify(pagarmePlan));
        err.status = 400;
        throw err;
    }

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

    console.log('PLANO:', JSON.stringify(plan, null, 2));

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

    console.log('BARBEARIA:', JSON.stringify(shop, null, 2));

    let useSplit = false;
    let recipient = null;
    if (shop?.pagarme_recipient_id) {
        try {
            recipient = await pagarmeRequest(`/recipients/${encodeURIComponent(shop.pagarme_recipient_id)}`, {
                method: 'GET',
            });
            console.log('RECIPIENT:', JSON.stringify(recipient, null, 2));
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
    console.log('CARTAO TOKEN:', params.cardToken);

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

    const idempotencyKeySub = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString();

    const payload: any = {
        code: `client_sub_${Date.now()}_${idempotencyKeySub.slice(0, 8)}`,
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
        card: {
            billing_address: {
                line_1: params.customer?.address?.line_1 || 'Rua Principal, 100',
                zip_code: params.customer?.address?.zip_code || '01001000',
                city: params.customer?.address?.city || 'São Paulo',
                state: params.customer?.address?.state || 'SP',
                country: params.customer?.address?.country || 'BR'
            }
        },
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

    console.log('PAYLOAD PAGARME (CRIAR ASSINATURA):', JSON.stringify(payload, null, 2));

    let pagarmeSubscription;
    try {
        pagarmeSubscription = await pagarmeRequest('/subscriptions', {
            method: 'POST',
            headers: {
                'Idempotency-Key': idempotencyKeySub,
            },
            body: JSON.stringify(payload),
        });
        console.log('RESPOSTA PAGARME (CRIAR ASSINATURA):', JSON.stringify(pagarmeSubscription, null, 2));
    } catch (e: any) {
        console.error('ERRO PAGARME (CRIAR ASSINATURA):', e?.message);
        throw e;
    }

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

    let subscription;
    try {
        subscription = existingSubscription
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
    } catch (dbError) {
        console.error('ERRO DE VALIDAÇÃO DO PRISMA AO SALVAR ASSINATURA:', dbError);
        const err: any = new Error('Erro ao salvar os dados da assinatura no banco local. O Pagar.me processou a solicitação.');
        err.status = 500;
        err.details = dbError;
        throw err;
    }

    if (pagarmeSubscription.status === 'failed' || pagarmeSubscription.status === 'canceled') {
        console.error('\n=== ASSINATURA FALHOU NO PAGAR.ME ===');
        console.error('STATUS:', pagarmeSubscription.status);
        console.error('CURRENT CYCLE:', JSON.stringify(pagarmeSubscription.current_cycle, null, 2));
        console.error('CARD:', JSON.stringify(pagarmeSubscription.card, null, 2));
        console.error('ITEMS:', JSON.stringify(pagarmeSubscription.items, null, 2));
        console.error('SPLIT:', JSON.stringify(pagarmeSubscription.split, null, 2));
        console.error('CHARGES:', JSON.stringify(pagarmeSubscription.charges, null, 2));
        
        let chargeError = '';
        if (pagarmeSubscription.charges && pagarmeSubscription.charges.length > 0) {
            const lastCharge = pagarmeSubscription.charges[0];
            const lastTransaction = lastCharge.last_transaction;
            console.error('LAST TRANSACTION:', JSON.stringify(lastTransaction, null, 2));
            console.error('GATEWAY RESPONSE:', JSON.stringify(lastTransaction?.gateway_response, null, 2));
            console.error('ACQUIRER MESSAGE:', lastTransaction?.acquirer_message);
            console.error('ACQUIRER RETURN CODE:', lastTransaction?.acquirer_return_code);
            chargeError = lastTransaction?.acquirer_message || lastTransaction?.gateway_response?.errors?.[0]?.message || 'Recusado pelo banco emissor.';
        } else {
            console.warn('Assinatura falhou mas não veio com charges no payload. Buscando detalhes da assinatura...');
            try {
                const subDetail = await pagarmeRequest(`/subscriptions/${pagarmeSubscription.id}`, { method: 'GET' });
                console.error('DETALHES COMPLETOS DA ASSINATURA:', JSON.stringify(subDetail, null, 2));
                const lastCharge = subDetail.charges?.[0];
                const lastTransaction = lastCharge?.last_transaction;
                console.error('LAST TRANSACTION FETCHED:', JSON.stringify(lastTransaction, null, 2));
                chargeError = lastTransaction?.acquirer_message || lastTransaction?.gateway_response?.errors?.[0]?.message || 'Falha ao processar assinatura.';
            } catch (err) {
                console.error('Falha ao buscar detalhes adicionais da assinatura:', err);
                chargeError = 'Falha desconhecida na assinatura.';
            }
        }

        const friendlyErr: any = new Error(`A assinatura foi recusada pelo Pagar.me. Motivo: ${chargeError}. Por favor, tente com outro cartão ou revise seus dados.`);
        friendlyErr.status = 402; // Payment Required
        throw friendlyErr;
    }

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
