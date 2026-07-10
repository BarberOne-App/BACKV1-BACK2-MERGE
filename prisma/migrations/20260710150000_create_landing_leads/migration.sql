CREATE TYPE "landing_lead_status" AS ENUM ('new', 'in_contact', 'converted', 'discarded');

CREATE TABLE "landing_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnpj" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing_whatsapp',
    "status" "landing_lead_status" NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "contacted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "landing_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_landing_leads_status" ON "landing_leads"("status");
CREATE INDEX "idx_landing_leads_created_at" ON "landing_leads"("created_at");
