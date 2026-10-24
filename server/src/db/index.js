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
await ensureColumn('conversation_members', 'last_delivered_at', 'INTEGER DEFAULT 0');
await ensureColumn('users', 'phone', 'TEXT');
await ensureColumn('users', 'google_id', 'TEXT');
await ensureColumn('users', 'avatar_url', 'TEXT');
await ensureColumn('conversations', 'avatar_url', 'TEXT');
// Bumped to invalidate every token issued before (password change, "sign out
// everywhere"). Tokens minted before this column existed carry no version and
// are treated as version 0, so nobody is logged out by the migration.
await ensureColumn('users', 'token_version', 'INTEGER NOT NULL DEFAULT 0');
// Lower-cased copies for substring search: SQLite's LOWER()/LIKE only fold
// ASCII, so Cyrillic is folded in JS on write and matched with instr().
await ensureColumn('users', 'display_name_lower', 'TEXT');
await ensureColumn('messages', 'content_search', 'TEXT');
// Two-step verification (TOTP). The secret is stored encrypted; the pending
// one only becomes the real one after the user proves they can generate codes.
await ensureColumn('users', 'totp_secret', 'TEXT');
await ensureColumn('users', 'totp_pending_secret', 'TEXT');
await ensureColumn('users', 'totp_enabled', 'INTEGER NOT NULL DEFAULT 0');
await ensureColumn('users', 'totp_last_step', 'INTEGER NOT NULL DEFAULT 0');
await ensureColumn('users', 'totp_failed', 'INTEGER NOT NULL DEFAULT 0');
await ensureColumn('users', 'totp_locked_until', 'INTEGER NOT NULL DEFAULT 0');

await client.executeMultiple(`
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_media ON messages(conversation_id, created_at) WHERE deleted = 0 AND file_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, created_at);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes(user_id);
`);

await client.executeMultiple(`
CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (message_id, user_id)
);
`);

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

/** Normalised form stored in the *_search / *_lower columns. */
export const searchKey = (text) => String(text ?? '').toLowerCase();

const BACKFILL_BATCH = 500;

// Fills the search columns for rows written before they existed. Runs in the
// background after startup; until a row is filled, queries fall back to the
// ASCII-only LOWER() so search keeps working, just less precisely.
export async function backfillSearchColumns() {
  for (;;) {
    const rows = await all(
      `SELECT id, display_name FROM users WHERE display_name_lower IS NULL LIMIT ${BACKFILL_BATCH}`
    );
    if (rows.length === 0) break;
    await batch(
      rows.map((r) => ({ sql: 'UPDATE users SET display_name_lower = ? WHERE id = ?', args: [searchKey(r.display_name), r.id] }))
    );
  }
  await run("UPDATE messages SET content_search = '' WHERE content_search IS NULL AND content = ''");
  for (;;) {
    const rows = await all(`SELECT id, content FROM messages WHERE content_search IS NULL LIMIT ${BACKFILL_BATCH}`);
    if (rows.length === 0) break;
    await batch(
      rows.map((r) => ({ sql: 'UPDATE messages SET content_search = ? WHERE id = ?', args: [searchKey(r.content), r.id] }))
    );
  }
}

export default client;
