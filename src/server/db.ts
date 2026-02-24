import Database from 'better-sqlite3';

const db = new Database('scenarios.db');
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    base_date TEXT,
    tags TEXT, -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS scenario_parameters (
    scenario_id TEXT,
    block_type TEXT,
    data TEXT, -- JSON object
    PRIMARY KEY (scenario_id, block_type),
    FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id TEXT,
    action TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    details TEXT
  );
`);

export default db;
