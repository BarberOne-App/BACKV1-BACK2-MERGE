CREATE TABLE IF NOT EXISTS "customer_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "barbershop_id" uuid NOT NULL,
  "appointment_id" uuid,
  "barber_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_customer_reviews_barbershop" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_customer_reviews_appointment" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_customer_reviews_barber" FOREIGN KEY ("barber_id") REFERENCES "barbers"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_customer_reviews_client" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "ck_customer_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_customer_reviews_appointment"
  ON "customer_reviews"("appointment_id")
  WHERE "appointment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_customer_reviews_barbershop"
  ON "customer_reviews"("barbershop_id");

CREATE INDEX IF NOT EXISTS "idx_customer_reviews_barber"
  ON "customer_reviews"("barber_id");

CREATE INDEX IF NOT EXISTS "idx_customer_reviews_client"
  ON "customer_reviews"("client_id");

CREATE INDEX IF NOT EXISTS "idx_customer_reviews_created_at"
  ON "customer_reviews"("created_at");
