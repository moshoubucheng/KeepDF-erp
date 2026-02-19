-- Migration v22: Add barcode column to products for barcode/QR scanning
-- Run: npx wrangler d1 execute keepdf-erp --remote --file=src/db/migration-v22.sql

ALTER TABLE products ADD COLUMN barcode TEXT;
CREATE INDEX idx_products_barcode ON products(barcode);
