CREATE TABLE IF NOT EXISTS "whatsapp_login_otps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "barbershop_id" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_login_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_whatsapp_login_otps_user" ON "whatsapp_login_otps" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_login_otps_barbershop" ON "whatsapp_login_otps" ("barbershop_id");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_login_otps_phone" ON "whatsapp_login_otps" ("phone");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_login_otps_expires_at" ON "whatsapp_login_otps" ("expires_at");

ALTER TABLE "whatsapp_login_otps"
ADD CONSTRAINT "fk_whatsapp_login_otps_user"
FOREIGN KEY ("user_id") REFERENCES "users" ("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "whatsapp_login_otps"
ADD CONSTRAINT "fk_whatsapp_login_otps_barbershop"
FOREIGN KEY ("barbershop_id") REFERENCES "barbershops" ("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
