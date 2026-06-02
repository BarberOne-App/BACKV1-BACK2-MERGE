/*
  Warnings:

  - A unique constraint covering the columns `[mp_preapproval_plan_id]` on the table `subscription_plans` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "mp_preapproval_plan_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_mp_preapproval_plan_id_key" ON "subscription_plans"("mp_preapproval_plan_id");
