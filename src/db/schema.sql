-- ============================================================
-- Smart ERP - D1 Schema V2.0 (Complete)
-- All tables from 跨境电商智能中台ERP_MVP白皮书V2.0
-- ============================================================

-- ===== Distributors =====
CREATE TABLE IF NOT EXISTS distributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER DEFAULT 0,
  language TEXT DEFAULT 'ja',
  balance REAL DEFAULT 0.0,
  frozen_balance REAL DEFAULT 0.0,
  tax_reg_number TEXT,
  role TEXT DEFAULT 'distributor' CHECK(role IN ('admin', 'distributor')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== Products (PIM) =====
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name_cn TEXT,
  name_jp TEXT,
  cost_price REAL NOT NULL,
  tax_category TEXT DEFAULT 'standard' CHECK(tax_category IN ('standard', 'reduced')),
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  color TEXT,
  size TEXT,
  sku TEXT UNIQUE NOT NULL,
  stock_qty INTEGER DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS platform_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_sku TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'TEMU', 'RAKUTEN')),
  platform_sku TEXT NOT NULL,
  UNIQUE(platform, platform_sku)
);

-- ===== Orders =====
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  platform_order_id TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED')),
  total_amount REAL,
  tax_total REAL,
  distributor_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME,
  cancelled_at DATETIME,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  tax_rate REAL DEFAULT 0.10,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ===== Warehouse =====
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inbound_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  expected_qty INTEGER NOT NULL,
  actual_qty INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbound_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  tracking_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ===== Finance =====
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('DEPOSIT','FREEZE','DEDUCT','REFUND')),
  amount REAL NOT NULL,
  related_order_id TEXT,
  balance_snapshot REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  platform TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE,
  pdf_url TEXT,
  tax_details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ===== Commission Settlements =====
CREATE TABLE IF NOT EXISTS commission_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  platform TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  commission_rate REAL NOT NULL,
  commission_amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SETTLED', 'FAILED')),
  settled_at DATETIME,
  wallet_tx_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ===== V2.0 新增 =====
CREATE TABLE IF NOT EXISTS api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('INFO','WARNING','CRITICAL')),
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform, platform_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_wallet_distributor ON wallet_transactions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_wallet_created ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_api_logs_platform ON api_logs(platform, created_at);
CREATE INDEX IF NOT EXISTS idx_platform_map ON platform_mappings(local_sku);
CREATE INDEX IF NOT EXISTS idx_commission_distributor ON commission_settlements(distributor_id);
CREATE INDEX IF NOT EXISTS idx_commission_order ON commission_settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_settlements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(distributor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_delivered ON orders(status, distributor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(order_id, sku);

-- ===== Platform Sync Logs =====
CREATE TABLE IF NOT EXISTS platform_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'TEMU', 'RAKUTEN')),
  sync_type TEXT NOT NULL CHECK(sync_type IN ('MANUAL', 'CRON')),
  orders_fetched INTEGER DEFAULT 0,
  orders_queued INTEGER DEFAULT 0,
  status TEXT DEFAULT 'RUNNING' CHECK(status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON platform_sync_logs(platform, started_at);

-- ===== Audit Logs =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_distributor ON audit_logs(distributor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at);
