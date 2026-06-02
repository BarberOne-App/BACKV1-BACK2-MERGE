import Stripe from "stripe";
import prisma from "../database/database.js";
import { badRequest, notFound } from "../errors/index.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

function getProfileRedirectUrl() {
  const baseUrl =
    process.env.FRONTEND_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_WEB_URL ||
    process.env.PUBLIC_WEB_URL ||
    "http://localhost:5173";

  const normalizedBase = String(baseUrl).replace(/\/+$/, "");
  return `${normalizedBase}/profile`;
}

function toAmountInCents(amount: number) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw badRequest("Preço do plano inválido para criar assinatura na Stripe.");
  }
  return Math.round(value * 100);
}

export async function provisionConnectRecurringPlan(params: {
  barbershopId: string;
  planName: string;
  amount: number;
  existingProductId?: string | null;
}) {
  const shop = await prisma.barbershops.findUnique({
    where: { id: params.barbershopId },
    select: {
      id: true,
      name: true,
      stripe_connect_account_id: true,
      stripe_connect_charges_enabled: true,
      stripe_connect_payouts_enabled: true,
    },
  });

  if (!shop) throw notFound("Barbearia não encontrada.");

  if (!shop.stripe_connect_account_id) {
    throw badRequest("Conta Stripe Connect não configurada para esta barbearia.");
  }

  const stripeAccount = shop.stripe_connect_account_id;
  const amountInCents = toAmountInCents(params.amount);

  let productId = String(params.existingProductId || "").trim();

  if (productId) {
    try {
      await stripe.products.update(
        productId,
        {
          name: params.planName,
          metadata: {
            barbershopId: shop.id,
          },
        },
        { stripeAccount },
      );
    } catch {
      productId = "";
    }
  }

  if (!productId) {
    const product = await stripe.products.create(
      {
        name: params.planName,
        metadata: {
          barbershopId: shop.id,
          barbershopName: shop.name,
        },
      },
      { stripeAccount },
    );
    productId = product.id;
  }

  const price = await stripe.prices.create(
    {
      product: productId,
      currency: "brl",
      unit_amount: amountInCents,
      recurring: {
        interval: "month",
      },
      metadata: {
        barbershopId: shop.id,
      },
    },
    { stripeAccount },
  );

  const paymentLink = await stripe.paymentLinks.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        barbershopId: shop.id,
      },
      allow_promotion_codes: true,
      after_completion: {
        type: "redirect",
        redirect: {
          url: getProfileRedirectUrl(),
        },
      },
    },
    { stripeAccount },
  );

  return {
    stripeProductId: productId,
    stripePriceId: price.id,
    stripePaymentLinkUrl: paymentLink.url,
  };
}
