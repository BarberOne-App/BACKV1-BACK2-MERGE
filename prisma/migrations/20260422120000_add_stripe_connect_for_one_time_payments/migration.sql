-- Stripe Connect metadata per barbershop
ALTER TABLE "barbershops"
ADD COLUMN "stripe_connect_account_id" TEXT,
ADD COLUMN "stripe_connect_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_details_submitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripe_connect_onboarding_completed_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "barbershops_stripe_connect_account_id_key"
ON "barbershops"("stripe_connect_account_id");

-- Stripe traceability for one-time payments
ALTER TABLE "payment_transactions"
ADD COLUMN "stripe_payment_intent_id" TEXT,
ADD COLUMN "stripe_charge_id" TEXT,
ADD COLUMN "stripe_destination_account_id" TEXT,
ADD COLUMN "stripe_application_fee_amount" INTEGER;
