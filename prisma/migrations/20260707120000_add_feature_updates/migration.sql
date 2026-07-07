CREATE TABLE "feature_updates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feature_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_feature_updates_active_created_at"
  ON "feature_updates"("active", "created_at");
