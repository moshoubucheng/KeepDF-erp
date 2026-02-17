-- Migration V20: Bugfix — commissions UNIQUE constraint + orders NOT NULL defaults
-- Run after deploying the bugfix commit

-- H8: Prevent duplicate commission rates for same sku+platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_sku_platform ON commissions(sku, platform);

-- M11: Backfill NULL total_amount/tax_total in existing orders
UPDATE orders SET total_amount = 0 WHERE total_amount IS NULL;
UPDATE orders SET tax_total = 0 WHERE tax_total IS NULL;
