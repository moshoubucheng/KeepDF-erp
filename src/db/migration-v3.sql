-- ============================================================
-- Smart ERP - Migration V3.0 (Production)
-- Sprint 3: RBAC + Platform Sync
-- ============================================================

-- Add role column to distributors
ALTER TABLE distributors ADD COLUMN role TEXT DEFAULT 'distributor' CHECK(role IN ('admin', 'distributor'));

-- Platform Sync Logs
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
