ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "google_id" TEXT,
ADD COLUMN IF NOT EXISTS "auth_provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
