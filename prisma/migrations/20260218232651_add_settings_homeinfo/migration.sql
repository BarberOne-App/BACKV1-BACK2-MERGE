-- CreateTable
CREATE TABLE "barbershop_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barbershop_id" UUID NOT NULL,
    "pix_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barbershop_home_info" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barbershop_id" UUID NOT NULL,
    "about_title" TEXT,
    "about_text1" TEXT,
    "about_text2" TEXT,
    "about_text3" TEXT,
    "schedule_title" TEXT,
    "schedule_line1" TEXT,
    "schedule_line2" TEXT,
    "schedule_line3" TEXT,
    "location_title" TEXT,
    "location_address" TEXT,
    "location_city" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barbershop_home_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barbershop_settings_barbershop_id_key" ON "barbershop_settings"("barbershop_id");

-- CreateIndex
CREATE INDEX "idx_settings_barbershop_id" ON "barbershop_settings"("barbershop_id");

-- CreateIndex
CREATE UNIQUE INDEX "barbershop_home_info_barbershop_id_key" ON "barbershop_home_info"("barbershop_id");

-- CreateIndex
CREATE INDEX "idx_homeinfo_barbershop_id" ON "barbershop_home_info"("barbershop_id");

-- AddForeignKey
ALTER TABLE "barbershop_settings" ADD CONSTRAINT "fk_settings_barbershop" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "barbershop_home_info" ADD CONSTRAINT "fk_homeinfo_barbershop" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
