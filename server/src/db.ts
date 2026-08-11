import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'gift_ledger.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

// ──────────────────────────────────────────────
// Initialize Tables
// ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    relation   TEXT NOT NULL DEFAULT '朋友',
    tag        TEXT,
    phone      TEXT,
    remark     TEXT,
    avatar_bg  TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    title               TEXT NOT NULL,
    date                TEXT NOT NULL,
    type                TEXT NOT NULL DEFAULT 'other',
    is_hosted_by_me     INTEGER NOT NULL DEFAULT 1,
    total_amount        REAL NOT NULL DEFAULT 0,
    guest_count         INTEGER,
    target_contact_name TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS records (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    event_id         TEXT,
    event_title      TEXT NOT NULL,
    event_date       TEXT NOT NULL,
    event_type       TEXT NOT NULL DEFAULT 'other',
    type             TEXT NOT NULL CHECK(type IN ('received', 'given')),
    contact_id       TEXT,
    contact_name     TEXT NOT NULL,
    contact_relation TEXT,
    amount           REAL NOT NULL DEFAULT 0,
    payment_method   TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'wechat', 'alipay', 'custom')),
    custom_payment_method TEXT,
    remark           TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
  CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
  CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
  CREATE INDEX IF NOT EXISTS idx_records_contact ON records(contact_id);
  CREATE INDEX IF NOT EXISTS idx_records_event ON records(event_id);
`);

// 兼容已有数据库：CREATE TABLE IF NOT EXISTS 不会自动补充新字段。
const recordColumns = db.prepare('PRAGMA table_info(records)').all() as { name: string }[];
const recordColumnNames = new Set(recordColumns.map((column) => column.name));
if (!recordColumnNames.has('payment_method')) {
  db.exec("ALTER TABLE records ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'");
}
if (!recordColumnNames.has('custom_payment_method')) {
  db.exec('ALTER TABLE records ADD COLUMN custom_payment_method TEXT');
}

export default db;
