ALTER TABLE "services"
ALTER COLUMN "comission_percent" TYPE DECIMAL(5, 2)
USING "comission_percent"::DECIMAL(5, 2);
