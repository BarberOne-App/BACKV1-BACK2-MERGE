/*
  Warnings:

  - You are about to drop the column `mp_preapproval_plan_id` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `mp_subscription_url` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_payment_link_url` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_price_id` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_product_id` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `mp_preapproval_id` on the `subscriptions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_current_barbershop_id_fkey";

-- DropIndex
DROP INDEX "idx_plans_barbershop_stripe_price";

-- DropIndex
DROP INDEX "idx_plans_barbershop_stripe_product";

-- DropIndex
DROP INDEX "subscription_plans_mp_preapproval_plan_id_key";

-- AlterTable
ALTER TABLE "subscription_plans" DROP COLUMN "mp_preapproval_plan_id",
DROP COLUMN "mp_subscription_url",
DROP COLUMN "stripe_payment_link_url",
DROP COLUMN "stripe_price_id",
DROP COLUMN "stripe_product_id",
ADD COLUMN     "pagarme_plan_id" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "mp_preapproval_id",
ADD COLUMN     "pagarme_customer_id" TEXT,
ADD COLUMN     "pagarme_plan_id" TEXT,
ADD COLUMN     "pagarme_recipient_id" TEXT,
ADD COLUMN     "pagarme_subscription_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_current_barbershop_id_fkey" FOREIGN KEY ("current_barbershop_id") REFERENCES "barbershops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
