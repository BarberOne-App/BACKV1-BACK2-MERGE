import { Request, Response } from "express";
import prisma from "../database/database.js";

// export async function getMyActiveSubscription(req: Request, res: Response) {
//   const subscription = await prisma.subscriptions.findFirst({
//     where: {
//       user_id: req.user!.id,
//       status: "active",
//     },
//     orderBy: {
//       updated_at: "desc",
//     },
//     include: {
//       subscription_plans: {
//         select: {
//           id: true,
//           name: true,
//           price: true,
//         },
//       },
//     },
//   });

//   if (!subscription) {
//     return res.status(200).send(null);
//   }

//   return res.status(200).send({
//     id: subscription.id,
//     userId: subscription.user_id,
//     planId: subscription.plan_id,
//     planName: subscription.subscription_plans?.name ?? null,
//     status: subscription.status,
//     nextBillingDate: subscription.next_billing_at,
//     cancelAtPeriodEnd: !subscription.auto_renewal,
//     stripeSubscriptionId: subscription.legacy_id,
//   });
// }

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

export async function getMyActiveSubscription() {

  const email = "ana.costa.teste@example.com";
  // 1) Busca customers com email exato
  const customers = await stripe.customers.list({
    email,
    limit: 100,
  });

  if (!customers.data.length) {
    return {
      found: false,
      message: 'Nenhum customer encontrado para esse email.',
      subscriptions: [],
    };
  }

  // 2) Busca subscriptions de todos os customers encontrados
  const results = [];

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all', // inclui active, canceled, incomplete, etc.
      limit: 100,
    });

    results.push({
      customerId: customer.id,
      customerEmail: customer.email,
      customerName: customer.name,
      subscriptions: subscriptions.data.map((sub) => ({
        subscriptionId: sub.id,
        status: sub.status,
        // currentPeriodStart: sub.current_period_start,
        // currentPeriodEnd: sub.current_period_end,
        // cancelAtPeriodEnd: sub.cancel_at_period_end,
      })),
    });
  }

  return {
    found: true,
    totalCustomers: customers.data.length,
    results,
  };
}