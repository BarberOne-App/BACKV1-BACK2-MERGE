import jwt from "jsonwebtoken";
import { badRequest, notFound, unauthorized } from "../errors/index.js";
import {
    findBarbershopForReactivation,
} from "../repository/platformSubscriptionRepository.js";
import {
    createPagarmeBarbershopPlatformSubscriptionService,
} from "../services/pagarmePlatformSubscriptionService.js";

type SubscriptionIntentPayload = {
    type: string;
    userId: string;
    barbershopId: string;
};

function verifySubscriptionIntentToken(token: string): SubscriptionIntentPayload {
    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as SubscriptionIntentPayload;

        if (decoded.type !== "barbershop_subscription_reactivation") {
            throw unauthorized("Token de reativação inválido.");
        }

        return decoded;
    } catch {
        throw unauthorized("Token de reativação expirado ou inválido.");
    }
}

export async function reactivateBarbershopPlatformSubscriptionService(params: {
    barbershopId: string;
    platformPlanId: string;
    amount: number;
    subscriptionIntentToken: string;
    cardToken: string;
    customer?: {
        name?: string | null;
        email?: string | null;
        document?: string | null;
        phone?: string | null;
    };
}) {
    const tokenPayload = verifySubscriptionIntentToken(params.subscriptionIntentToken);

    if (tokenPayload.barbershopId !== params.barbershopId) {
        throw unauthorized("Token não pertence a esta barbearia.");
    }

    const barbershop = await findBarbershopForReactivation(params.barbershopId);

    if (!barbershop) {
        throw notFound("Barbearia não encontrada.");
    }

    const barbershopStatus = String(barbershop.status || "").toLowerCase();
    const subscriptionStatus = String(barbershop.platform_subscription_status || "").toLowerCase();

    console.log("Barbershop Status:", barbershopStatus);
    console.log("Subscription Status:", subscriptionStatus);

    const canReactivate =
        ["trial_expired", "expired", "suspended", "inactive"].includes(barbershopStatus) ||
        ["expired", "cancelled", "canceled", "past_due", "paused", null].includes(subscriptionStatus);

    if (!canReactivate) {
        throw badRequest("Esta barbearia não está disponível para reativação.");
    }

    if (!params.cardToken) {
        throw badRequest("cardToken é obrigatório para reativar a assinatura.");
    }

    const result = await createPagarmeBarbershopPlatformSubscriptionService(
        {
            barbershopId: params.barbershopId,
            platformPlanId: params.platformPlanId,
            amount: params.amount,
            cardToken: params.cardToken,
            customer: params.customer,
        },
        {
            id: tokenPayload.userId,
            barbershopId: params.barbershopId,
            name: params.customer?.name || barbershop.name,
            email: params.customer?.email || barbershop.email,
            cpf: params.customer?.document,
            phone: params.customer?.phone,
        }
    );

    return {
        message: "Barbearia reativada com sucesso.",
        barbershopId: params.barbershopId,
        subscription: result,
    };
}