-- Add birth_date column to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birth_date" DATE;
