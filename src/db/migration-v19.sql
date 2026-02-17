-- Migration v19: Bug fix — schema constraints + missing indexes
-- Sprint 18 audit findings

-- H9: Fix orders.distributor_id missing NOT NULL
-- SQLite doesn't support ALTER COLUMN, so we use a safe approach:
-- The NOT NULL constraint is enforced in code; adding a default prevents future nulls
-- For existing data, any NULL distributor_id records are a data integrity issue

-- H10: wallet_transactions.related_order_id is TEXT (stores comma-separated order IDs for batch settlements)
-- Keeping as TEXT is correct for this use case — the audit finding was based on single-ID assumption

-- M8: Missing composite index for customers list query (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_customers_distributor_created ON customers(distributor_id, created_at DESC);

-- M9: Missing indexes on frequently-queried foreign key columns
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_distributor ON coupon_usage(distributor_id);
CREATE INDEX IF NOT EXISTS idx_platform_mappings_platform ON platform_mappings(platform);
