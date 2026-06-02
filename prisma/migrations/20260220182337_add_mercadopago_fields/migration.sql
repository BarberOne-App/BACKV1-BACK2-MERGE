-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "mp_payment_id" TEXT,
ADD COLUMN     "mp_preference_id" TEXT;

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "mp_subscription_url" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "mp_preapproval_id" TEXT;
