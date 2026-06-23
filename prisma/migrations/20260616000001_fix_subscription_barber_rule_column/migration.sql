-- Fix: migration 20260611000000_add_subscription_barber_rule was created with empty SQL (comment only),
-- so the column was never added to existing databases.
-- Using IF NOT EXISTS makes this idempotent: safe for fresh databases and existing ones alike.
ALTER TABLE "barbershop_settings"
ADD COLUMN IF NOT EXISTS "subscription_barber_rule" TEXT NOT NULL DEFAULT 'fixed';
