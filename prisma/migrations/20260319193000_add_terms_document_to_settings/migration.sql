-- Add columns to store Terms and Documents metadata/content URL
ALTER TABLE "barbershop_settings"
  ADD COLUMN IF NOT EXISTS "terms_document_url" TEXT,
  ADD COLUMN IF NOT EXISTS "terms_document_name" TEXT;
