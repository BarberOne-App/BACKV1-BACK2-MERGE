ALTER TABLE "barbershops"
ADD COLUMN IF NOT EXISTS "pagarme_recipient_id" TEXT;

ALTER TABLE "payment_transactions"
ADD COLUMN IF NOT EXISTS "pagarme_order_id" TEXT,
ADD COLUMN IF NOT EXISTS "pagarme_charge_id" TEXT,
ADD COLUMN IF NOT EXISTS "pagarme_status" TEXT;
