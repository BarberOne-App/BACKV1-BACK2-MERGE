import {
    createPagarmeOrderService,
    createPagarmeRecipientService,
    getPagarmeOrderStatusService,
    getPagarmeRecipientService,
    normalizePagarmeOrder,
    updatePagarmeRecipientService,
} from '../services/pagarmeOrderService.js';
import { syncPagarmeSubscriptionWebhook } from '../services/pagarmePlatformSubscriptionService.js';
import prisma from '../database/database.js';
import { Request, Response, NextFunction } from 'express';

export async function createPagarmeOrderController(req: Request, res: Response, next: NextFunction) {
    console.log('createPagarmeOrderController called with body:', req.body);
    try {
        const result = await createPagarmeOrderService(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
}

export async function getPagarmeOrderStatusController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await getPagarmeOrderStatusService(req.params.orderId);
        return res.json(result);
    } catch (error) {
        return next(error);
    }
}

export async function createPagarmeRecipientController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await createPagarmeRecipientService(req.body);
        return res.status(201).json(result);
    } catch (error) {
        return next(error);
    }
}

export async function getPagarmeRecipientController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await getPagarmeRecipientService(req.params.recipientId);
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
}

export async function updatePagarmeRecipientController(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await updatePagarmeRecipientService({
            ...req.body,
            recipientId: req.params.recipientId,
        });
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
}

// Configure essa URL no Dashboard Pagar.me.
// Ela é importante porque PIX e alguns status podem ser assíncronos.
export async function pagarmeWebhookController(req: Request, res: Response, next: NextFunction) {
    try {
        const eventType = req.body?.type || req.body?.event || '';
        const eventData = req.body?.data || req.body?.order || req.body;
        const order = eventData?.object === 'order' || eventData?.charges ? eventData : eventData?.order || eventData;
        const subscription = eventData?.object === 'subscription'
            ? eventData
            : eventData?.subscription || eventData?.data?.subscription || req.body?.subscription || req.body?.data?.subscription || null;
        const normalized = order ? normalizePagarmeOrder(order) : null;

        const metadata = subscription?.metadata || order?.metadata || eventData?.metadata || {};
        const metadataType = String(metadata?.type || '').trim();
        const paymentId = metadata.paymentId;
        const appointmentId = metadata.appointmentId;

        console.log('[pagarmeWebhook] evento recebido', {
            eventType,
            metadataType,
            paymentId: paymentId || null,
            appointmentId: appointmentId || null,
            subscriptionId: subscription?.id || null,
            orderId: order?.id || null,
        });

        if (metadataType === 'barbershop_platform_subscription' || metadataType === 'client_barbershop_subscription') {
            const subscriptionResult = await syncPagarmeSubscriptionWebhook(eventType, subscription || order || eventData, metadata);

            if (subscriptionResult?.handled) {
                return res.status(200).json({ received: true });
            }
        }

        const isPaid =
            eventType === 'order.paid' ||
            eventType === 'charge.paid' ||
            normalized?.status === 'paid' ||
            normalized?.chargeStatus === 'paid';

        const isFailed =
            eventType === 'order.payment_failed' ||
            eventType === 'charge.payment_failed' ||
            normalized?.status === 'failed' ||
            normalized?.chargeStatus === 'failed';

        if ((isPaid || isFailed) && paymentId) {
            await prisma.payment_transactions.update({
                where: { id: String(paymentId) },
                data: {
                    status: isPaid ? 'paid' : 'failed',
                    method: 'credito',
                    paid_at: isPaid ? new Date() : null,
                    pagarme_order_id: normalized?.orderId,
                    pagarme_charge_id: normalized?.chargeId,
                    pagarme_status: normalized?.status,
                },
            });
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        return next(error);
    }
}
