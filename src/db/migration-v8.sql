-- ============================================================
-- Sprint 8 Migration: Shipments, Customers, Import, Notifications, Settings
-- Run AFTER migration-v6.sql on existing data
-- ============================================================

-- Shipments
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
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_distributor ON shipments(distributor_id, created_at);

-- Customers
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
CREATE INDEX IF NOT EXISTS idx_customers_distributor ON customers(distributor_id);

-- Add customer_id to orders
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);

-- Import Logs
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

-- Notifications (in-app)
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
CREATE INDEX IF NOT EXISTS idx_notifications_distributor ON notifications(distributor_id, is_read, created_at);

-- Notification Preferences
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_pref_unique ON notification_preferences(distributor_id, event_type);
