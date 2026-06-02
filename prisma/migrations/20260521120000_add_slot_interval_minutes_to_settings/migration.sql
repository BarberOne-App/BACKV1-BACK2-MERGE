ALTER TABLE "barbershop_settings"
ADD COLUMN IF NOT EXISTS "slot_interval_minutes" INTEGER NOT NULL DEFAULT 30;