-- ============================================================
-- Sprint 9 Migration: Returns, Procurement, Pricing, Communication, Forecasting
-- Run after migration-v6.sql on existing D1 databases
-- ============================================================

-- ===== Feature 1: Returns/Refunds =====
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

-- ===== Feature 2: Procurement/Suppliers =====
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

-- ===== Feature 3: Price Management =====
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

-- ===== Feature 4: Customer Communication =====
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

-- ===== Feature 6: Inventory Forecasting (cache table) =====
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
