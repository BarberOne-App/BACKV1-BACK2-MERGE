CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Keep the application checks for friendly errors, but make overlapping writes
-- impossible even when two requests arrive at the same time.
ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_barber_overlap"
EXCLUDE USING gist (
  "barbershop_id" WITH =,
  "barber_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("status" NOT IN ('cancelled', 'no_show'));

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_client_overlap"
EXCLUDE USING gist (
  "barbershop_id" WITH =,
  "client_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("dependent_id" IS NULL AND "status" NOT IN ('cancelled', 'no_show'));

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_dependent_overlap"
EXCLUDE USING gist (
  "barbershop_id" WITH =,
  "dependent_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("dependent_id" IS NOT NULL AND "status" NOT IN ('cancelled', 'no_show'));
