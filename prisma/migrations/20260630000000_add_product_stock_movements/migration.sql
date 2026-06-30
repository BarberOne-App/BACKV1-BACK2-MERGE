CREATE TABLE IF NOT EXISTS "product_stock_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "barbershop_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "purchase_price" DECIMAL(12, 2),
  "sale_price" DECIMAL(12, 2),
  "stock_after" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "product_stock_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_product_stock_movements_product"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "fk_product_stock_movements_barbershop"
    FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "fk_product_stock_movements_created_by"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "ck_product_stock_movements_type"
    CHECK ("type" IN ('entry', 'exit')),
  CONSTRAINT "ck_product_stock_movements_quantity"
    CHECK ("quantity" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_product_stock_movements_barbershop"
  ON "product_stock_movements"("barbershop_id");

CREATE INDEX IF NOT EXISTS "idx_product_stock_movements_date"
  ON "product_stock_movements"("barbershop_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "idx_product_stock_movements_product"
  ON "product_stock_movements"("product_id");

CREATE INDEX IF NOT EXISTS "idx_product_stock_movements_type"
  ON "product_stock_movements"("type");
