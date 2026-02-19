-- Migration v21: Search indexes for global search
-- Run: npx wrangler d1 execute keepdf-erp --remote --file=src/db/migration-v21.sql

CREATE INDEX IF NOT EXISTS idx_orders_platform_order_id ON orders(platform_order_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(distributor_id, name);
CREATE INDEX IF NOT EXISTS idx_products_name_jp ON products(name_jp);
CREATE INDEX IF NOT EXISTS idx_products_name_cn ON products(name_cn);
