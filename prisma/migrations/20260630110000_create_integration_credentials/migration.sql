CREATE TABLE IF NOT EXISTS "integration_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "barbershop_id" UUID NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'AresChat',
  "token_hash" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_credentials_token_hash_key"
ON "integration_credentials" ("token_hash");

CREATE INDEX IF NOT EXISTS "idx_integration_credentials_barbershop"
ON "integration_credentials" ("barbershop_id");

CREATE INDEX IF NOT EXISTS "idx_integration_credentials_provider_active"
ON "integration_credentials" ("provider", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_integration_credentials_barbershop'
  ) THEN
    ALTER TABLE "integration_credentials"
    ADD CONSTRAINT "fk_integration_credentials_barbershop"
    FOREIGN KEY ("barbershop_id")
    REFERENCES "barbershops"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION;
  END IF;
END $$;
