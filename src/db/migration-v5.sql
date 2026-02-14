-- ============================================================
-- Smart ERP - Migration V5 (Sprint 5)
-- Order lifecycle + Product image support
-- ============================================================

ALTER TABLE products ADD COLUMN image_url TEXT;
ALTER TABLE orders ADD COLUMN delivered_at DATETIME;
ALTER TABLE orders ADD COLUMN cancelled_at DATETIME;
