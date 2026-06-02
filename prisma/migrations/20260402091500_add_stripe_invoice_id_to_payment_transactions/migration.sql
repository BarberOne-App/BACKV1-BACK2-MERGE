ALTER TABLE "payment_transactions"
ADD COLUMN IF NOT EXISTS "stripe_invoice_id" TEXT;
