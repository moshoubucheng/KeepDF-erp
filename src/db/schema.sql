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
  customer_id INTEGER,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
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

-- ===== Shipments =====
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL CHECK(carrier IN ('YAMATO','SAGAWA','JAPAN_POST','FEDEX','DHL','OTHER')),
  status TEXT DEFAULT 'SHIPPED' CHECK(status IN ('SHIPPED','IN_TRANSIT','DELIVERED','RETURNED')),
  shipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  estimated_delivery DATETIME,
  distributor_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== Customers =====
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  prefecture TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'JP',
  platform TEXT,
  platform_customer_id TEXT,
  tags TEXT DEFAULT '[]',
  notes TEXT,
  distributor_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== Import Logs =====
CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('PRODUCTS','ORDERS')),
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_details TEXT,
  distributor_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== Notifications =====
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'ORDER_SHIPPED','ORDER_DELIVERED','ORDER_CANCELLED',
    'LOW_STOCK','COMMISSION_SETTLED','IMPORT_COMPLETE','SYSTEM_ALERT'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  related_resource_type TEXT,
  related_resource_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== Notification Preferences =====
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  channel TEXT DEFAULT 'IN_APP',
  webhook_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

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
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_distributor ON shipments(distributor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customers_distributor ON customers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_distributor ON notifications(distributor_id, is_read, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_pref_unique ON notification_preferences(distributor_id, event_type);

-- ===== Returns/Refunds =====
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  shipment_id INTEGER,
  distributor_id INTEGER NOT NULL,
  status TEXT DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','APPROVED','RECEIVED','REFUNDED','REJECTED')),
  reason TEXT,
  notes TEXT,
  refund_type TEXT CHECK(refund_type IN ('FULL','PARTIAL')),
  refund_amount REAL,
  wallet_tx_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);
CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  reason TEXT,
  FOREIGN KEY (return_id) REFERENCES returns(id)
);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_distributor ON returns(distributor_id, status);
CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);

-- ===== Suppliers =====
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT, contact_email TEXT, contact_phone TEXT,
  address TEXT, payment_terms TEXT,
  lead_time_days INTEGER DEFAULT 7,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','CONFIRMED','SHIPPED','RECEIVED','CLOSED')),
  total_amount REAL DEFAULT 0,
  notes TEXT,
  expected_delivery DATETIME,
  received_at DATETIME,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES distributors(id)
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  received_qty INTEGER DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- ===== Price Management =====
CREATE TABLE IF NOT EXISTS price_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('TIKTOK','TEMU','RAKUTEN','ALL')),
  base_price REAL NOT NULL,
  sale_price REAL,
  valid_from DATETIME, valid_to DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  platform TEXT NOT NULL,
  old_price REAL,
  new_price REAL NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('BASE','SALE','COST')),
  changed_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (changed_by) REFERENCES distributors(id)
);
CREATE INDEX IF NOT EXISTS idx_price_rules_sku ON price_rules(sku, platform);
CREATE INDEX IF NOT EXISTS idx_price_history_sku ON price_history(sku, platform, created_at);

-- ===== Customer Communication =====
CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('ORDER_CONFIRMATION','SHIPPING_NOTIFICATION','DELIVERY_CONFIRMATION','RETURN_APPROVED','RETURN_REJECTED','CUSTOM')),
  subject TEXT,
  body TEXT NOT NULL,
  channel TEXT DEFAULT 'EMAIL' CHECK(channel IN ('EMAIL','SMS','IN_APP')),
  is_active INTEGER DEFAULT 1,
  distributor_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);
CREATE TABLE IF NOT EXISTS customer_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  template_id INTEGER,
  type TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'EMAIL',
  status TEXT DEFAULT 'SENT' CHECK(status IN ('SENT','DELIVERED','FAILED')),
  related_order_id INTEGER,
  distributor_id INTEGER NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (template_id) REFERENCES message_templates(id),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);
CREATE TABLE IF NOT EXISTS message_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('ORDER_CREATED','ORDER_SHIPPED','ORDER_DELIVERED','ORDER_CANCELLED','RETURN_APPROVED','RETURN_REJECTED')),
  template_id INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  distributor_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES message_templates(id),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON customer_messages(customer_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_distributor ON customer_messages(distributor_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_templates_distributor ON message_templates(distributor_id, type);
CREATE INDEX IF NOT EXISTS idx_triggers_event ON message_triggers(event_type, distributor_id, is_active);

-- ===== Inventory Forecasting =====
CREATE TABLE IF NOT EXISTS inventory_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL,
  daily_velocity REAL DEFAULT 0,
  weekly_velocity REAL DEFAULT 0,
  days_of_stock REAL DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_sku ON inventory_forecasts(sku);
