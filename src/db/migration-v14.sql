-- Sprint 14 Migration: 12 new tables + 9 indexes
-- Run after migration-v13.sql

-- A1: 物流費用管理
CREATE TABLE IF NOT EXISTS shipping_fee_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    carrier TEXT NOT NULL,
    region TEXT DEFAULT 'DOMESTIC',
    weight_min_g INTEGER DEFAULT 0,
    weight_max_g INTEGER DEFAULT 999999,
    base_fee INTEGER NOT NULL DEFAULT 0,
    per_kg_fee INTEGER DEFAULT 0,
    platform TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipping_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    template_id INTEGER REFERENCES shipping_fee_templates(id),
    carrier TEXT NOT NULL,
    tracking_number TEXT,
    actual_fee INTEGER NOT NULL DEFAULT 0,
    estimated_fee INTEGER DEFAULT 0,
    weight_g INTEGER,
    reconciled INTEGER DEFAULT 0,
    reconciled_at DATETIME,
    distributor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- A2: 在庫棚卸
CREATE TABLE IF NOT EXISTS stocktakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'DRAFT',
    notes TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    distributor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stocktake_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id),
    sku TEXT NOT NULL,
    location_code TEXT NOT NULL,
    expected_qty INTEGER NOT NULL DEFAULT 0,
    actual_qty INTEGER,
    variance INTEGER GENERATED ALWAYS AS (COALESCE(actual_qty, 0) - expected_qty) STORED,
    notes TEXT,
    counted_at DATETIME
);

-- B1: 顧客セグメント + RFM
CREATE TABLE IF NOT EXISTS customer_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT NOT NULL DEFAULT '{}',
    color TEXT DEFAULT '#8b5cf6',
    auto_update INTEGER DEFAULT 1,
    customer_count INTEGER DEFAULT 0,
    distributor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- B3: プロモーション
CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    discount_value INTEGER NOT NULL DEFAULT 0,
    min_order_amount INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    buy_quantity INTEGER,
    get_quantity INTEGER,
    applicable_skus TEXT DEFAULT '[]',
    applicable_platforms TEXT DEFAULT '[]',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    max_uses INTEGER DEFAULT 0,
    current_uses INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    distributor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- C1: 承認ワークフロー
CREATE TABLE IF NOT EXISTS approval_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    conditions TEXT NOT NULL DEFAULT '{}',
    approver_ids TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES approval_workflows(id),
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    requested_by INTEGER NOT NULL,
    approved_by INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- C2: 監査スナップショット
CREATE TABLE IF NOT EXISTS audit_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_log_id INTEGER NOT NULL REFERENCES audit_logs(id),
    before_data TEXT,
    after_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- C3: Webhook
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    last_triggered_at DATETIME,
    failure_count INTEGER DEFAULT 0,
    distributor_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint_id INTEGER NOT NULL REFERENCES webhook_endpoints(id),
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    success INTEGER DEFAULT 0,
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- D2: Dashboard レイアウト
CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_id INTEGER NOT NULL UNIQUE,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_fees_order ON shipping_fees(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_reconciled ON shipping_fees(reconciled);
CREATE INDEX IF NOT EXISTS idx_stocktakes_status ON stocktakes(status);
CREATE INDEX IF NOT EXISTS idx_stocktake_items_stocktake ON stocktake_items(stocktake_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_log ON audit_snapshots(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_distributor ON webhook_endpoints(distributor_id);
