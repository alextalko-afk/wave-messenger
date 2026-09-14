import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isRemote = !!process.env.TURSO_DATABASE_URL;

let url;
if (isRemote) {
  url = process.env.TURSO_DATABASE_URL;
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'messenger.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  url = `file:${dbPath}`;
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

if (!isRemote) {
  await client.executeMultiple('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
}

await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  bio TEXT DEFAULT '',
  last_seen INTEGER DEFAULT (strftime('%s','now')),
  online INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  is_group INTEGER DEFAULT 0,
  name TEXT,
  avatar_color TEXT DEFAULT '#7c5cff',
  created_by TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at INTEGER DEFAULT (strftime('%s','now')),
  last_read_at INTEGER DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  reply_to_id TEXT,
  edited_at INTEGER,
  deleted INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);

CREATE TABLE IF NOT EXISTS phone_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT,
  kind TEXT NOT NULL DEFAULT 'audio',
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at INTEGER DEFAULT (strftime('%s','now')),
  answered_at INTEGER,
  ended_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id, started_at);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id, started_at);
`);

async function ensureColumn(table, column, definition) {
  const res = await client.execute(`PRAGMA table_info(${table})`);
  const exists = res.rows.some((c) => c.name === column);
  if (!exists) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

await ensureColumn('conversation_members', 'pinned', 'INTEGER DEFAULT 0');
await ensureColumn('conversation_members', 'muted', 'INTEGER DEFAULT 0');
await ensureColumn('conversation_members', 'manually_unread', 'INTEGER DEFAULT 0');
await ensureColumn('conversation_members', 'cleared_before', 'INTEGER DEFAULT 0');
await ensureColumn('users', 'phone', 'TEXT');
await ensureColumn('users', 'google_id', 'TEXT');
await ensureColumn('users', 'avatar_url', 'TEXT');

export async function get(sql, args = []) {
  const res = await client.execute({ sql, args });
  return res.rows[0] || null;
}

export async function all(sql, args = []) {
  const res = await client.execute({ sql, args });
  return res.rows;
}

export async function run(sql, args = []) {
  const res = await client.execute({ sql, args });
  return { changes: Number(res.rowsAffected), lastInsertRowid: res.lastInsertRowid };
}

export async function batch(statements) {
  return client.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args || [] })),
    'write'
  );
}

export default client;
