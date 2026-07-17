-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "subscription_status" ADD VALUE 'failed';
ALTER TYPE "subscription_status" ADD VALUE 'future';
ALTER TYPE "subscription_status" ADD VALUE 'pending';
ALTER TYPE "subscription_status" ADD VALUE 'paid';
ALTER TYPE "subscription_status" ADD VALUE 'unpaid';
ALTER TYPE "subscription_status" ADD VALUE 'trialing';

-- DropForeignKey
ALTER TABLE "barbershop_platform_subscriptions" DROP CONSTRAINT "fk_platform_subscription_plan";

-- DropForeignKey
ALTER TABLE "customer_reviews" DROP CONSTRAINT "fk_customer_reviews_appointment";

-- DropForeignKey
ALTER TABLE "customer_reviews" DROP CONSTRAINT "fk_customer_reviews_barber";

-- DropForeignKey
ALTER TABLE "customer_reviews" DROP CONSTRAINT "fk_customer_reviews_barbershop";

-- DropForeignKey
ALTER TABLE "customer_reviews" DROP CONSTRAINT "fk_customer_reviews_client";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "salary" DOUBLE PRECISION DEFAULT 0;

-- CreateIndex
DROP INDEX IF EXISTS "uq_customer_reviews_appointment";

CREATE UNIQUE INDEX "uq_customer_reviews_appointment"
ON "customer_reviews"("appointment_id");

-- AddForeignKey
ALTER TABLE "barbershop_platform_subscriptions" ADD CONSTRAINT "fk_platform_subscription_plan" FOREIGN KEY ("platform_plan_id") REFERENCES "platform_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "fk_customer_reviews_barbershop" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "fk_customer_reviews_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "fk_customer_reviews_barber" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "fk_customer_reviews_client" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
