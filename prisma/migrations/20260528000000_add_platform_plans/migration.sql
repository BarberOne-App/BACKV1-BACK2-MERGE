-- CreateTable: platform_plans
CREATE TABLE "platform_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'month',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "trial_period_days" INTEGER NOT NULL DEFAULT 0,
    "pagarme_plan_id" TEXT,
    "max_barbers" INTEGER,
    "max_admins" INTEGER,
    "max_receptionists" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_plan_features
CREATE TABLE "platform_plan_features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "platform_plan_features_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: platform_plan_features -> platform_plans
ALTER TABLE "platform_plan_features"
ADD CONSTRAINT "fk_platform_plan_features_plan"
FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateIndex: platform_plans
CREATE INDEX "idx_platform_plans_active_public" ON "platform_plans"("active", "is_public");
CREATE INDEX "idx_platform_plans_sort_order" ON "platform_plans"("sort_order");

-- CreateIndex: platform_plan_features
CREATE INDEX "idx_platform_plan_features_plan" ON "platform_plan_features"("plan_id");

-- AlterTable: barbershop_platform_subscriptions (adicionar FK para platform_plans)
ALTER TABLE "barbershop_platform_subscriptions"
ADD COLUMN "platform_plan_id" UUID;

-- AddForeignKey: barbershop_platform_subscriptions -> platform_plans
ALTER TABLE "barbershop_platform_subscriptions"
ADD CONSTRAINT "fk_platform_subscription_plan"
FOREIGN KEY ("platform_plan_id") REFERENCES "platform_plans"("id") ON UPDATE NO ACTION;

-- CreateIndex: barbershop_platform_subscriptions
CREATE INDEX "idx_platform_subscriptions_plan_id" ON "barbershop_platform_subscriptions"("platform_plan_id");
