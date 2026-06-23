ALTER TABLE "barbershop_settings"
ADD COLUMN IF NOT EXISTS "commission_rule_type" TEXT NOT NULL DEFAULT 'FIXED_BARBER';
