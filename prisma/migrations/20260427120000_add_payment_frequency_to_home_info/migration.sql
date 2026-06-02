ALTER TABLE "barbershop_home_info"
ADD COLUMN IF NOT EXISTS "barber_payment_frequency" TEXT,
ADD COLUMN IF NOT EXISTS "employee_payment_frequency" TEXT;
