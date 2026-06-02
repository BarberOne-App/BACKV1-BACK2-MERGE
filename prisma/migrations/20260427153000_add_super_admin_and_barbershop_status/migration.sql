-- Add Super Admin role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'super_admin';

-- Add status enum for barbershops
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'barbershop_status') THEN
    CREATE TYPE "barbershop_status" AS ENUM ('active', 'inactive', 'blocked', 'pending');
  END IF;
END $$;

-- Add governance columns to barbershops
ALTER TABLE "barbershops"
ADD COLUMN IF NOT EXISTS "status" "barbershop_status" NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "blocked_reason" TEXT,
ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "idx_barbershops_status"
ON "barbershops"("status");
