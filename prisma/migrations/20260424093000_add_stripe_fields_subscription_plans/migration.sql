ALTER TABLE "subscription_plans"
ADD COLUMN "stripe_product_id" TEXT,
ADD COLUMN "stripe_price_id" TEXT,
ADD COLUMN "stripe_payment_link_url" TEXT;

CREATE INDEX "idx_plans_barbershop_stripe_product"
ON "subscription_plans"("barbershop_id", "stripe_product_id");

CREATE INDEX "idx_plans_barbershop_stripe_price"
ON "subscription_plans"("barbershop_id", "stripe_price_id");
