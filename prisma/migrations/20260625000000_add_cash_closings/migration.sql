CREATE TABLE IF NOT EXISTS "cash_closings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barbershop_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "closed_by" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "totals_by_method" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "payment_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "note" TEXT,
    CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_cash_closings_barbershop" ON "cash_closings"("barbershop_id");
CREATE INDEX IF NOT EXISTS "idx_cash_closings_period" ON "cash_closings"("barbershop_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_cash_closings_closed_at" ON "cash_closings"("barbershop_id", "closed_at");

ALTER TABLE "cash_closings"
ADD CONSTRAINT "fk_cash_closings_barbershop"
FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "cash_closings"
ADD CONSTRAINT "fk_cash_closings_closed_by"
FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
