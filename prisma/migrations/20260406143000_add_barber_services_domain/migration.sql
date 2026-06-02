CREATE TABLE IF NOT EXISTS "barber_services" (
  "barber_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pk_barber_services" PRIMARY KEY ("barber_id", "service_id"),
  CONSTRAINT "fk_barber_services_barber" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "fk_barber_services_service" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_barber_services_barber_id" ON "barber_services" ("barber_id");
CREATE INDEX IF NOT EXISTS "idx_barber_services_service_id" ON "barber_services" ("service_id");
