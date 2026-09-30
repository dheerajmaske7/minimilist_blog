CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,
  agent TEXT NOT NULL,
  status INTEGER,
  visitor_id TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  tx_hash TEXT PRIMARY KEY,
  amount_usdc REAL NOT NULL DEFAULT 0.01,
  ts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0,
  patterns TEXT NOT NULL,
  description TEXT,
  capabilities TEXT,
  updated_at TEXT NOT NULL
);
