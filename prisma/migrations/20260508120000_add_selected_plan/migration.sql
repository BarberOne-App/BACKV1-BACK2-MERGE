BEGIN;

ALTER TABLE "barbershops" ADD COLUMN "selected_plan" text;

COMMIT;