-- Allow super_admin users to exist without a bound barbershop
ALTER TABLE "users"
ALTER COLUMN "current_barbershop_id" DROP NOT NULL;
