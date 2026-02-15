-- ============================================================
-- Sprint 11: Automation Rules + Batch Operations
-- Run after migration-v9.sql
-- ============================================================

-- ===== Automation Rules =====
CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('AUTO_REORDER','AUTO_PRICE_ADJUST','STOCK_ALERT')),
  conditions TEXT NOT NULL,  -- JSON
  actions TEXT NOT NULL,     -- JSON
  is_active INTEGER DEFAULT 1,
  distributor_id INTEGER NOT NULL,
  last_run_at DATETIME,
  run_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id)
);

-- ===== Automation Logs =====
CREATE TABLE IF NOT EXISTS automation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  rule_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('CRON','EVENT','MANUAL')),
  status TEXT NOT NULL CHECK(status IN ('SUCCESS','FAILED','SKIPPED','NO_MATCH')),
  details TEXT,
  items_affected INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_automation_rules_type ON automation_rules(type, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_distributor ON automation_rules(distributor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status, created_at);
