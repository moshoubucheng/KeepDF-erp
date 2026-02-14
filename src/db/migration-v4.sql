-- ============================================================
-- Smart ERP - Migration V4: Audit Logs
-- Run on production D1 database
-- ============================================================

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
