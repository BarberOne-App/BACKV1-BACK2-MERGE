ALTER TABLE "barbershop_settings"
ADD COLUMN "hidden_booking_payment_methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
