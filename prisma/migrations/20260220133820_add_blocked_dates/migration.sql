-- CreateTable
CREATE TABLE "blocked_dates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barbershop_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "barber_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_blocked_dates_barbershop" ON "blocked_dates"("barbershop_id");

-- CreateIndex
CREATE INDEX "idx_blocked_dates_barbershop_date" ON "blocked_dates"("barbershop_id", "date");

-- AddForeignKey
ALTER TABLE "blocked_dates" ADD CONSTRAINT "fk_blocked_dates_barbershop" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blocked_dates" ADD CONSTRAINT "fk_blocked_dates_barber" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blocked_dates" ADD CONSTRAINT "fk_blocked_dates_user" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
