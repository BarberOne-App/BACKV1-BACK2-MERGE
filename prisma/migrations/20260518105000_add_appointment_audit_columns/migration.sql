ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "last_modified_by" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "last_action_description" TEXT;

CREATE INDEX IF NOT EXISTS "idx_appointments_last_modified_by" ON "appointments"("last_modified_by");
