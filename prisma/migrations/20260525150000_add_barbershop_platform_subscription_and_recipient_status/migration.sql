ALTER TABLE "barbershops"
ADD COLUMN "platform_subscription_status" TEXT,
ADD COLUMN "pagarme_recipient_status" TEXT;

CREATE TABLE "barbershop_platform_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barbershop_id" UUID NOT NULL,
    "selected_plan" TEXT NOT NULL,
    "pagarme_subscription_id" TEXT,
    "pagarme_plan_id" TEXT,
    "pagarme_customer_id" TEXT,
    "status" TEXT NOT NULL,
    "payment_method" TEXT,
    "amount" DECIMAL(12,2),
    "start_date" TIMESTAMPTZ(6),
    "next_billing_date" TIMESTAMPTZ(6),
    "canceled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershop_platform_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "barbershop_platform_subscriptions_barbershop_id_key"
ON "barbershop_platform_subscriptions" ("barbershop_id");

CREATE UNIQUE INDEX "barbershop_platform_subscriptions_pagarme_subscription_id_key"
ON "barbershop_platform_subscriptions" ("pagarme_subscription_id");

CREATE INDEX "idx_platform_subscriptions_status"
ON "barbershop_platform_subscriptions" ("status");

CREATE INDEX "idx_platform_subscriptions_pagarme_id"
ON "barbershop_platform_subscriptions" ("pagarme_subscription_id");

ALTER TABLE "barbershop_platform_subscriptions"
ADD CONSTRAINT "fk_platform_subscription_barbershop"
FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
