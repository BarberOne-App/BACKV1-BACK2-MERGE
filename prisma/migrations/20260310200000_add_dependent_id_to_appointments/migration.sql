-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "dependent_id" UUID;

-- CreateIndex
CREATE INDEX "idx_appointments_dependent_id" ON "appointments"("dependent_id");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "fk_appointments_dependent" FOREIGN KEY ("dependent_id") REFERENCES "dependents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
