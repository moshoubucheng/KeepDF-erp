-- ============================================================
-- Migration V10: Performance indexes
-- Sprint 10: Performance Optimization
-- ============================================================

-- Forecasting: aggregate queries on warehouse_locations by SKU
CREATE INDEX IF NOT EXISTS idx_warehouse_sku ON warehouse_locations(sku);

-- Order detail: order_items by order_id (composite idx_order_items_sku covers order_id+sku but not order_id alone)
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Forecasting + low-stock: order_items by SKU alone
CREATE INDEX IF NOT EXISTS idx_order_items_sku_only ON order_items(sku);

-- PO receive: purchase_order_items by SKU
CREATE INDEX IF NOT EXISTS idx_po_items_sku ON purchase_order_items(sku);
