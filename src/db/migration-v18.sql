-- Sprint 18: Web Push Notifications
-- push_subscriptions table for Web Push API

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (distributor_id) REFERENCES distributors(id),
  UNIQUE(distributor_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_distributor ON push_subscriptions(distributor_id);
