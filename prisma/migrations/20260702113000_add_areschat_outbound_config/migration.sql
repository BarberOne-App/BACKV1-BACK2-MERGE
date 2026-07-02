ALTER TABLE "integration_credentials"
ADD COLUMN IF NOT EXISTS "send_message_url" TEXT,
ADD COLUMN IF NOT EXISTS "whatsapp_token_encrypted" TEXT,
ADD COLUMN IF NOT EXISTS "whatsapp_token_prefix" TEXT;
