-- ============================================================
-- Sprint 12: Multi-currency, Shipment Tracking, SKU Mapping, Coupons
-- ============================================================

-- ===== 1. Exchange Rates =====
CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency TEXT NOT NULL CHECK(from_currency IN ('JPY','USD','CNY')),
  to_currency TEXT NOT NULL CHECK(to_currency IN ('JPY','USD','CNY')),
  rate REAL NOT NULL,
  source TEXT DEFAULT 'MANUAL',
  updated_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_currency, to_currency)
);

-- ===== 2. Shipment Events Timeline =====
CREATE TABLE IF NOT EXISTS shipment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('SHIPPED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','RETURNED','EXCEPTION')),
  location TEXT,
  description TEXT,
  event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

-- ===== 3. Coupons =====
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING')),
  value REAL NOT NULL,
  currency TEXT DEFAULT 'JPY',
  min_order_amount REAL DEFAULT 0,
  max_discount REAL,
  usage_limit INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  platform TEXT DEFAULT 'ALL',
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES distributors(id)
);

-- ===== 4. Coupon Usage =====
CREATE TABLE IF NOT EXISTS coupon_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  distributor_id INTEGER NOT NULL,
  discount_amount REAL NOT NULL,
  discount_amount_jpy REAL NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== ALTER existing tables =====

-- orders: multi-currency + coupon
ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'JPY';
ALTER TABLE orders ADD COLUMN total_amount_jpy REAL;
ALTER TABLE orders ADD COLUMN exchange_rate REAL DEFAULT 1.0;
ALTER TABLE orders ADD COLUMN coupon_id INTEGER;
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
UPDATE orders SET total_amount_jpy = total_amount, currency = 'JPY' WHERE total_amount_jpy IS NULL;

-- shipments: actual delivery
ALTER TABLE shipments ADD COLUMN actual_delivery DATETIME;
ALTER TABLE shipments ADD COLUMN delivery_notes TEXT;

-- platform_mappings: enhanced
ALTER TABLE platform_mappings ADD COLUMN price_sync INTEGER DEFAULT 0;
ALTER TABLE platform_mappings ADD COLUMN stock_sync INTEGER DEFAULT 0;
ALTER TABLE platform_mappings ADD COLUMN platform_title TEXT;
ALTER TABLE platform_mappings ADD COLUMN platform_description TEXT;
ALTER TABLE platform_mappings ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE platform_mappings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON shipment_events(shipment_id, event_time);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code, is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_platform ON coupons(platform, is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order ON coupon_usage(order_id);

-- ===== Default exchange rates =====
INSERT INTO exchange_rates (from_currency, to_currency, rate) VALUES
  ('USD', 'JPY', 149.50), ('CNY', 'JPY', 20.60),
  ('JPY', 'USD', 0.00669), ('JPY', 'CNY', 0.04854),
  ('USD', 'CNY', 7.26), ('CNY', 'USD', 0.1378);
