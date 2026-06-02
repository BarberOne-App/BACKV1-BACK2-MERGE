-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "fk_users_barbershop";

-- DropIndex
DROP INDEX "idx_users_barbershop_id";

-- 1) subscription_plans: adiciona coluna primeiro (NULL)
ALTER TABLE "subscription_plans" ADD COLUMN "barbershop_id" UUID;

-- 2) users: adiciona coluna nova como NULL primeiro
ALTER TABLE "users" ADD COLUMN "current_barbershop_id" UUID;

-- 3) backfill users.current_barbershop_id usando users.barbershop_id antigo
UPDATE "users"
SET "current_barbershop_id" = "barbershop_id"
WHERE "current_barbershop_id" IS NULL
  AND "barbershop_id" IS NOT NULL;

-- fallback: se algum user ainda ficar NULL, seta a primeira barbearia
UPDATE "users"
SET "current_barbershop_id" = (
  SELECT "id" FROM "barbershops" ORDER BY "created_at" ASC LIMIT 1
)
WHERE "current_barbershop_id" IS NULL;

-- 4) agora trava NOT NULL
ALTER TABLE "users" ALTER COLUMN "current_barbershop_id" SET NOT NULL;

-- 5) agora sim pode remover o barbershop_id antigo
ALTER TABLE "users" DROP COLUMN "barbershop_id";

-- 6) cria tabela N:N
CREATE TABLE "user_barbershops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "barbershop_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_barbershops_pkey" PRIMARY KEY ("id")
);

-- indexes / unique antes de qualquer ON CONFLICT (mais seguro)
CREATE INDEX "idx_user_barbershop_user" ON "user_barbershops"("user_id");
CREATE INDEX "idx_user_barbershop_barbershop" ON "user_barbershops"("barbershop_id");
CREATE UNIQUE INDEX "uq_user_barbershop" ON "user_barbershops"("user_id","barbershop_id");

-- 7) popula o vínculo com a barbearia atual
INSERT INTO "user_barbershops" ("user_id","barbershop_id","created_at")
SELECT "id","current_barbershop_id", now()
FROM "users";

-- 8) backfill subscription_plans.barbershop_id usando subscriptions.plan_id -> barbershop_id
UPDATE "subscription_plans" sp
SET "barbershop_id" = x."barbershop_id"
FROM (
  SELECT "plan_id", MIN("barbershop_id"::text)::uuid AS "barbershop_id"
  FROM "subscriptions"
  WHERE "barbershop_id" IS NOT NULL
  GROUP BY "plan_id"
) x
WHERE sp."id" = x."plan_id"
  AND sp."barbershop_id" IS NULL;

-- fallback: planos ainda NULL vão pra primeira barbearia
UPDATE "subscription_plans"
SET "barbershop_id" = (
  SELECT "id" FROM "barbershops" ORDER BY "created_at" ASC LIMIT 1
)
WHERE "barbershop_id" IS NULL;

-- trava NOT NULL (pra bater com seu schema final)
ALTER TABLE "subscription_plans" ALTER COLUMN "barbershop_id" SET NOT NULL;

-- indexes + uniques
CREATE INDEX "idx_plans_barbershop_id" ON "subscription_plans"("barbershop_id");
CREATE UNIQUE INDEX "uq_plan_name_per_barbershop" ON "subscription_plans"("barbershop_id","name");
CREATE UNIQUE INDEX "uq_subscription_user_barbershop" ON "subscriptions"("user_id","barbershop_id");
CREATE INDEX "idx_users_current_barbershop_id" ON "users"("current_barbershop_id");

-- FKs
ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "fk_plans_barbershop"
  FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_current_barbershop_id_fkey"
  FOREIGN KEY ("current_barbershop_id") REFERENCES "barbershops"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_barbershops"
  ADD CONSTRAINT "user_barbershops_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "user_barbershops"
  ADD CONSTRAINT "user_barbershops_barbershop_id_fkey"
  FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
