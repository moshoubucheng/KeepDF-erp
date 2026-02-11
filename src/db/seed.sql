-- ============================================================
-- Smart ERP - Seed Data (开发/测试用)
-- ============================================================

-- ===== 分销商 =====
INSERT INTO distributors (name, token, balance, frozen_balance, tax_reg_number) VALUES
  ('東京物産株式会社', 'tok_dev_abc123', 500000, 0, 'T1234567890123'),
  ('大阪商事有限会社', 'tok_dev_def456', 300000, 50000, 'T9876543210987'),
  ('福岡貿易合同会社', 'tok_dev_ghi789', 100000, 10000, 'T5555666677778');

-- ===== 商品 (PIM) =====
INSERT INTO products (sku, name_cn, name_jp, cost_price, tax_category) VALUES
  ('CARROT-500ML', '胡萝卜汁 500ml', 'にんじんジュース 500ml', 1200, 'reduced'),
  ('GRAPE-500ML', '葡萄汁 500ml', 'ぶどうジュース 500ml', 1500, 'reduced'),
  ('FACE-MASK-30', '面膜套装 30片', 'フェイスマスク 30枚入', 3800, 'standard'),
  ('RICE-5KG', '越光米 5kg', 'コシヒカリ 5kg', 2800, 'reduced'),
  ('MATCHA-100G', '抹茶粉 100g', '抹茶パウダー 100g', 2200, 'reduced'),
  ('CERAMIC-MUG', '日式陶瓷杯', '和風マグカップ', 1800, 'standard');

-- ===== 商品变体 =====
INSERT INTO product_variants (product_id, color, size, sku, stock_qty) VALUES
  (3, '白色', '30片', 'FACE-MASK-30-W', 200),
  (3, '黑色', '30片', 'FACE-MASK-30-B', 150),
  (6, '青', NULL, 'CERAMIC-MUG-BL', 80),
  (6, '赤', NULL, 'CERAMIC-MUG-RD', 60);

-- ===== 平台 SKU 映射 =====
INSERT INTO platform_mappings (local_sku, platform, platform_sku) VALUES
  ('CARROT-500ML', 'TIKTOK', 'TT-VEG-CARROT500'),
  ('CARROT-500ML', 'TEMU', 'TEMU-8801234'),
  ('GRAPE-500ML', 'TIKTOK', 'TT-FRT-GRAPE500'),
  ('GRAPE-500ML', 'RAKUTEN', 'RK-JUICE-GRAPE-500'),
  ('FACE-MASK-30', 'TIKTOK', 'TT-BEAUTY-FM30'),
  ('FACE-MASK-30', 'TEMU', 'TEMU-8805678'),
  ('RICE-5KG', 'RAKUTEN', 'RK-FOOD-RICE5KG'),
  ('MATCHA-100G', 'RAKUTEN', 'RK-TEA-MATCHA100'),
  ('MATCHA-100G', 'TIKTOK', 'TT-TEA-MATCHA100'),
  ('CERAMIC-MUG', 'TEMU', 'TEMU-8809999');

-- ===== 库位 =====
INSERT INTO warehouse_locations (code, sku, qty) VALUES
  ('A-01-01', 'CARROT-500ML', 500),
  ('A-01-02', 'GRAPE-500ML', 300),
  ('B-02-01', 'FACE-MASK-30', 350),
  ('B-02-02', 'RICE-5KG', 200),
  ('C-03-01', 'MATCHA-100G', 150),
  ('C-03-02', 'CERAMIC-MUG', 140);

-- ===== 示例订单 =====
INSERT INTO orders (platform, platform_order_id, status, total_amount, tax_total, distributor_id) VALUES
  ('TIKTOK', 'TT-ORD-20260201-001', 'DELIVERED', 4800, 384, 1),
  ('TEMU', 'TM-ORD-20260203-042', 'SHIPPED', 7600, 760, 1),
  ('RAKUTEN', 'RK-ORD-20260205-118', 'PROCESSING', 5600, 448, 2),
  ('TIKTOK', 'TT-ORD-20260208-203', 'PENDING', 3800, 380, 2),
  ('TEMU', 'TM-ORD-20260210-077', 'PENDING', 2400, 192, 3);

-- ===== 订单明细 =====
INSERT INTO order_items (order_id, sku, qty, unit_price, tax_rate) VALUES
  (1, 'CARROT-500ML', 2, 1200, 0.08),
  (1, 'GRAPE-500ML', 1, 1500, 0.08),
  (2, 'FACE-MASK-30', 2, 3800, 0.10),
  (3, 'RICE-5KG', 2, 2800, 0.08),
  (4, 'FACE-MASK-30', 1, 3800, 0.10),
  (5, 'CARROT-500ML', 2, 1200, 0.08);

-- ===== 出库记录 =====
INSERT INTO outbound_records (order_id, sku, tracking_number) VALUES
  (1, 'BATCH', 'JP-YAMATO-9901234567'),
  (2, 'BATCH', 'JP-SAGAWA-8807654321');

-- ===== 钱包流水 =====
INSERT INTO wallet_transactions (distributor_id, type, amount, related_order_id, balance_snapshot) VALUES
  (1, 'DEPOSIT', 500000, NULL, 500000),
  (1, 'FREEZE', 4800, '1', 495200),
  (1, 'DEDUCT', 4800, '1', 495200),
  (1, 'FREEZE', 7600, '2', 487600),
  (2, 'DEPOSIT', 350000, NULL, 350000),
  (2, 'FREEZE', 5600, '3', 344400),
  (2, 'FREEZE', 3800, '4', 340600),
  (3, 'DEPOSIT', 110000, NULL, 110000),
  (3, 'FREEZE', 2400, '5', 107600);

-- ===== 佣金费率 =====
INSERT INTO commissions (sku, platform, rate) VALUES
  ('CARROT-500ML', 'TIKTOK', 0.05),
  ('CARROT-500ML', 'TEMU', 0.08),
  ('GRAPE-500ML', 'TIKTOK', 0.05),
  ('FACE-MASK-30', 'TIKTOK', 0.06),
  ('FACE-MASK-30', 'TEMU', 0.10),
  ('RICE-5KG', 'RAKUTEN', 0.04),
  ('MATCHA-100G', 'RAKUTEN', 0.04);
