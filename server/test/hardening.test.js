import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@libsql/client';
import { startServer, emit, sleep } from './helpers.js';

const uploadedFiles = (srv) => readdirSync(path.join(srv.dir, 'uploads')).filter((f) => !f.startsWith('.'));

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * For rows the API can't create: stops the server, lets `write(db)` change its
 * database, and boots it again on the same data. The database file is never
 * touched while the server is running, since two processes writing to one
 * SQLite file make the server's connection fail with SQLITE_BUSY_SNAPSHOT.
 */
async function reseed(srv, write, options = {}) {
  const { dir } = srv;
  await srv.stop({ keepDir: true });
  const db = createClient({ url: `file:${path.join(dir, 'test.db')}` });
  try {
    await write(db);
  } finally {
    db.close();
  }
  return startServer({ ...options, dir });
}

describe('token revocation', () => {
  let srv, alice, bob, ghost;
  let current; // alice's most recent valid token

  before(async () => {
    srv = await startServer();
    [alice, bob, ghost] = await Promise.all([srv.createUser('Alice'), srv.createUser('Bob'), srv.createUser('Ghost')]);
    current = alice.token;
    const { body } = await srv.api('/api/auth/me', { token: alice.token });
    alice.username = body.user.username;
    srv = await reseed(srv, async (db) => {
      // phone sign-up gives accounts a random password; set a known one
      await db.execute({
        sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
        args: [bcrypt.hashSync('old-password-1', 4), alice.id],
      });
      await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [ghost.id] });
    });
  });
  after(() => srv.stop());

  const login = (password) =>
    srv.api('/api/auth/login', { method: 'POST', body: { username: alice.username, password } });

  it('changing the password revokes old tokens, hands back a new one, and closes old sockets', async () => {
    const first = await login('old-password-1');
    assert.equal(first.status, 200);
    const oldToken = first.body.token;
    const oldSocket = await srv.connect(oldToken);
    const closed = new Promise((resolve) => oldSocket.on('disconnect', resolve));
    const revoked = new Promise((resolve) => oldSocket.on('auth:revoked', () => resolve(true)));

    const wrong = await srv.api('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'nope', newPassword: 'brand-new-pass' },
      token: oldToken,
    });
    assert.equal(wrong.status, 401);
    assert.equal((await srv.api('/api/auth/me', { token: oldToken })).status, 200, 'a failed change keeps the session');

    const changed = await srv.api('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'old-password-1', newPassword: 'brand-new-pass' },
      token: oldToken,
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.body.token && changed.body.token !== oldToken);

    assert.equal((await srv.api('/api/auth/me', { token: oldToken })).status, 401);
    assert.equal((await srv.api('/api/auth/me', { token: changed.body.token })).status, 200);
    current = changed.body.token;
    await assert.rejects(srv.connect(oldToken), /unauthorized/);
    assert.ok(await revoked);
    await closed;

    const fresh = await srv.connect(changed.body.token);
    assert.ok(fresh.connected, 'the replacement token opens sockets');
    assert.equal((await login('old-password-1')).status, 401);
    assert.equal((await login('brand-new-pass')).status, 200);
  });

  it('"sign out other devices" closes sockets on the old token and returns a usable one', async () => {
    const keeper = await srv.connect(current);
    const dropped = new Promise((resolve) => keeper.on('disconnect', () => resolve(true)));
    const res = await srv.api('/api/auth/revoke-sessions', { method: 'POST', token: current });
    assert.equal(res.status, 200);
    assert.equal(await dropped, true);
    assert.equal((await srv.api('/api/auth/me', { token: current })).status, 401);
    assert.equal((await srv.api('/api/auth/me', { token: res.body.token })).status, 200);
    current = res.body.token;
  });

  it('rejects tokens whose user no longer exists', async () => {
    assert.equal((await srv.api('/api/auth/me', { token: ghost.token })).status, 401);
    assert.equal((await srv.api('/api/conversations', { token: ghost.token })).status, 401);
    await assert.rejects(srv.connect(ghost.token), /unauthorized/);
  });

  it('still accepts tokens minted before versions existed, until the user is revoked', async () => {
    const legacy = (id) => jwt.sign({ userId: id }, 'test-secret', { expiresIn: '1h' });
    assert.equal((await srv.api('/api/auth/me', { token: legacy(bob.id) })).status, 200);
    assert.equal((await srv.api('/api/auth/me', { token: legacy(alice.id) })).status, 401);
  });
});

describe('uploads', () => {
  let srv, alice, bob, group;
  before(async () => {
    srv = await startServer({ env: { UPLOAD_MAX_MB: '0.05', UPLOAD_DAILY_QUOTA_MB: '0.06' } });
    [alice, bob] = await Promise.all([srv.createUser('Alice'), srv.createUser('Bob')]);
    group = (
      await srv.api('/api/conversations/group', { method: 'POST', body: { name: 'G', memberIds: [bob.id] }, token: alice.token })
    ).body.conversation;
  });
  after(() => srv.stop());

  const send = (name, type, bytes, route = '/api/upload') => srv.upload(route, { token: alice.token, name, type, bytes });

  it('requires authentication', async () => {
    const res = await srv.upload('/api/upload', { name: 'a.txt', type: 'text/plain', bytes: 'hi' });
    assert.equal(res.status, 401);
  });

  it('stores ordinary attachments under a random name', async () => {
    const res = await send('../../report final.pdf', 'application/pdf', 'pdf bytes');
    assert.equal(res.status, 200);
    assert.match(res.body.url, /^\/uploads\/[\w-]+\.pdf$/);
    assert.ok(uploadedFiles(srv).includes(res.body.url.split('/').pop()));
  });

  it('refuses scriptable and executable file types', async () => {
    for (const name of ['page.html', 'logo.svg', 'run.js', 'setup.EXE', 'x.bat']) {
      const res = await send(name, 'application/octet-stream', 'x');
      assert.equal(res.status, 415, name);
    }
    assert.equal(uploadedFiles(srv).filter((f) => !f.endsWith('.pdf')).length, 0);
  });

  it('refuses files over the size limit', async () => {
    const res = await send('big.bin', 'application/octet-stream', Buffer.alloc(60 * 1024));
    assert.equal(res.status, 413);
    assert.match(res.body.error, /слишком большой/);
  });

  it('accepts real images as avatars and rejects look-alikes', async () => {
    const ok = await send('me.png', 'image/png', PNG, '/api/upload/avatar');
    assert.equal(ok.status, 200);
    assert.match(ok.body.user.avatarUrl, /^\/uploads\/[\w-]+\.png$/);

    const before = uploadedFiles(srv).length;
    assert.equal((await send('me.svg', 'image/svg+xml', '<svg/>', '/api/upload/avatar')).status, 415);
    assert.equal((await send('me.png', 'text/html', '<script>', '/api/upload/avatar')).status, 415);
    const fake = await send('me.png', 'image/png', '<html><script>alert(1)</script></html>', '/api/upload/avatar');
    assert.equal(fake.status, 415);
    await sleep(100);
    assert.equal(uploadedFiles(srv).length, before, 'a rejected avatar leaves nothing on disk');
  });

  it('only lets group admins upload a group avatar', async () => {
    const before = uploadedFiles(srv).length;
    const denied = await srv.upload(`/api/conversations/${group.id}/avatar`, {
      token: bob.token,
      name: 'g.png',
      type: 'image/png',
      bytes: PNG,
    });
    assert.equal(denied.status, 403);
    assert.equal(uploadedFiles(srv).length, before);

    const ok = await srv.upload(`/api/conversations/${group.id}/avatar`, {
      token: alice.token,
      name: 'g.png',
      type: 'image/png',
      bytes: PNG,
    });
    assert.equal(ok.status, 200);
    assert.match(ok.body.conversation.avatarUrl, /^\/uploads\//);
  });

  it('enforces a rolling daily byte quota per user', async () => {
    // quota is ~61 KB; the tests above used well under 1 KB of it
    const chunk = Buffer.alloc(40 * 1024, 'a');
    assert.equal((await send('one.bin', 'application/octet-stream', chunk)).status, 200);
    const over = await send('two.bin', 'application/octet-stream', chunk);
    assert.equal(over.status, 413);
    assert.match(over.body.error, /лимит/i);
    // another user is unaffected
    const other = await srv.upload('/api/upload', { token: bob.token, name: 'b.bin', type: 'application/octet-stream', bytes: chunk });
    assert.equal(other.status, 200);
  });
});

describe('orphaned upload cleanup', () => {
  it('removes only unreferenced files older than the grace period', async () => {
    const { mkdtempSync, writeFileSync, existsSync, utimesSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(path.join(tmpdir(), 'wave-cleanup-'));
    process.env.UPLOADS_DIR = dir;
    process.env.DB_PATH = path.join(dir, 'c.db');
    process.env.TURSO_DATABASE_URL = '';
    try {
      const { run } = await import('../src/db/index.js');
      const { cleanUpOrphanedUploads } = await import('../src/uploadCleanup.js');
      const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      const make = (name, aged) => {
        writeFileSync(path.join(dir, name), 'x');
        if (aged) utimesSync(path.join(dir, name), old, old);
      };
      make('orphan-old.png', true);
      make('orphan-new.png', false);
      make('used-by-message.png', true);
      make('used-as-avatar.png', true);
      await run("INSERT INTO users (id, username, display_name, password_hash, avatar_color, avatar_url) VALUES ('u1','u1','U','x','#000','/uploads/used-as-avatar.png')");
      await run("INSERT INTO conversations (id) VALUES ('c1')");
      await run("INSERT INTO messages (id, conversation_id, sender_id, file_url) VALUES ('m1','c1','u1','/uploads/used-by-message.png')");

      const removed = await cleanUpOrphanedUploads({ maxAgeMs: 24 * 3600 * 1000 });
      assert.equal(removed, 1);
      assert.equal(existsSync(path.join(dir, 'orphan-old.png')), false);
      for (const kept of ['orphan-new.png', 'used-by-message.png', 'used-as-avatar.png']) {
        assert.equal(existsSync(path.join(dir, kept)), true, kept);
      }
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* the sqlite file may stay locked on Windows until the process exits */
      }
    }
  });
});

describe('http hardening', () => {
  let srv;
  before(async () => {
    srv = await startServer();
  });
  after(() => srv.stop());

  it('sends security headers and hides the framework', async () => {
    const res = await fetch(`${srv.base}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok(res.headers.get('strict-transport-security'));
    assert.ok(res.headers.get('content-security-policy-report-only'));
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  it('rejects oversized JSON bodies', async () => {
    const res = await fetch(`${srv.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', password: 'y'.repeat(200 * 1024) }),
    });
    assert.equal(res.status, 413);
  });

  it('throttles search per user', async () => {
    const user = await srv.createUser('Searcher');
    let last;
    for (let i = 0; i < 45; i++) {
      last = await srv.api('/api/search/messages?q=hello', { token: user.token });
    }
    assert.equal(last.status, 429);
    const other = await srv.createUser('Other');
    assert.equal((await srv.api('/api/search/messages?q=hello', { token: other.token })).status, 200);
  });
});

describe('pagination', () => {
  let srv, alice, bob, conv, sa;
  const STAMP = Math.floor(Date.now() / 1000) - 1000;

  before(async () => {
    srv = await startServer();
    [alice, bob] = await Promise.all([srv.createUser('Алиса'), srv.createUser('Боб')]);
    conv = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: bob.id }, token: alice.token })).body.conversation;
    srv = await reseed(srv, async (db) => {
      // seven messages sharing one second, which a timestamp-only cursor can't split
      for (let i = 1; i <= 7; i++) {
        await db.execute({
          sql: `INSERT INTO messages (id, conversation_id, sender_id, content, content_search, file_url, file_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [`m${i}`, conv.id, alice.id, `Совпадение ${i}`, `совпадение ${i}`, i % 2 ? `/uploads/p${i}.png` : null, i % 2 ? 'image/png' : null, STAMP],
        });
      }
      // written before the search column existed: content_search stays NULL
      await db.execute({
        sql: `INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES ('legacy', ?, ?, 'Легаси Строка', ?)`,
        args: [conv.id, alice.id, STAMP - 5],
      });
      for (let i = 0; i < 4; i++) {
        await db.execute({
          sql: `INSERT INTO calls (id, caller_id, callee_id, conversation_id, kind, status, started_at) VALUES (?, ?, ?, ?, 'audio', 'missed', ?)`,
          args: [`call${i}`, alice.id, bob.id, conv.id, STAMP],
        });
      }
    });
    sa = await srv.connect(alice.token);
  });
  after(() => srv.stop());

  async function walk(route, key, limit) {
    const ids = [];
    let cursor = '';
    for (let guard = 0; guard < 20; guard++) {
      const { body } = await srv.api(`${route}${route.includes('?') ? '&' : '?'}limit=${limit}${cursor}`, { token: alice.token });
      ids.push(...body[key].map((x) => x.id));
      if (!body.hasMore) return { ids, last: body };
      assert.ok(body.nextCursor, 'hasMore comes with a cursor');
      cursor = `&before=${body.nextCursor.before}&beforeId=${body.nextCursor.beforeId}`;
    }
    throw new Error('did not terminate');
  }

  it('pages through messages that share a timestamp without skipping or repeating any', async () => {
    const { ids } = await walk(`/api/conversations/${conv.id}/messages`, 'messages', 3);
    assert.equal(ids.length, 8);
    assert.equal(new Set(ids).size, 8);
  });

  it('keeps the legacy before-only cursor and 50-message default working', async () => {
    const res = await srv.api(`/api/conversations/${conv.id}/messages?before=${STAMP + 1}`, { token: alice.token });
    assert.equal(res.body.messages.length, 8);
    assert.equal(res.body.hasMore, false);
    const asc = res.body.messages.map((m) => m.createdAt);
    assert.deepEqual(asc, [...asc].sort((a, b) => a - b), 'still oldest first within a page');
  });

  it('pages search results and media', async () => {
    const search = await walk('/api/search/messages?q=СОВПАДЕНИЕ', 'results', 2);
    assert.equal(search.ids.length, 7);
    assert.equal(new Set(search.ids).size, 7);
    const media = await walk(`/api/conversations/${conv.id}/media?type=photos`, 'items', 3);
    assert.equal(media.ids.length, 4);
    assert.equal(new Set(media.ids).size, 4);
  });

  it('backfills search text for messages written before the column existed', async () => {
    let ids = [];
    for (let i = 0; i < 30 && ids.length === 0; i++) {
      ids = (await srv.api('/api/search/messages?q=ЛЕГАСИ', { token: alice.token })).body.results.map((r) => r.id);
      if (ids.length === 0) await sleep(100);
    }
    assert.deepEqual(ids, ['legacy']);
  });

  it('keeps search in sync with edits and deletes', async () => {
    const { message } = await emit(sa, 'message:send', { conversationId: conv.id, content: 'Первоначальный ТЕКСТ' });
    const find = async (q) => (await srv.api(`/api/search/messages?q=${encodeURIComponent(q)}`, { token: alice.token })).body.results;
    assert.equal((await find('первоначальный')).length, 1);
    await emit(sa, 'message:edit', { messageId: message.id, content: 'Исправленный текст' });
    assert.equal((await find('первоначальный')).length, 0);
    assert.equal((await find('ИСПРАВЛЕННЫЙ')).length, 1);
    await emit(sa, 'message:delete', { messageId: message.id });
    assert.equal((await find('исправленный')).length, 0);
  });

  it('orders and pages the conversation list', async () => {
    const carol = await srv.createUser('Кэрол');
    const second = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: carol.id }, token: alice.token })).body
      .conversation;
    await srv.api(`/api/conversations/${second.id}/pin`, { method: 'POST', body: { pinned: true }, token: alice.token });

    const all = (await srv.api('/api/conversations', { token: alice.token })).body;
    assert.equal(all.hasMore, false);
    assert.deepEqual(all.conversations.map((c) => c.id), [second.id, conv.id], 'pinned chat first');

    const first = (await srv.api('/api/conversations?limit=1', { token: alice.token })).body;
    assert.equal(first.conversations.length, 1);
    assert.equal(first.hasMore, true);
    const next = (await srv.api('/api/conversations?limit=1&offset=1', { token: alice.token })).body;
    assert.deepEqual(next.conversations.map((c) => c.id), [conv.id]);
    assert.equal(next.hasMore, false);
  });

  it('pages user search and call history', async () => {
    for (const n of ['Анна', 'Анатолий', 'Антон']) await srv.createUser(n);
    const p1 = (await srv.api(`/api/users/search?q=${encodeURIComponent('АН')}&limit=2`, { token: alice.token })).body;
    assert.equal(p1.users.length, 2);
    assert.equal(p1.hasMore, true);
    const p2 = (await srv.api(`/api/users/search?q=${encodeURIComponent('АН')}&limit=2&offset=2`, { token: alice.token })).body;
    assert.ok(p2.users.length >= 1);
    assert.equal(new Set([...p1.users, ...p2.users].map((u) => u.id)).size, p1.users.length + p2.users.length);

    const calls = await walk('/api/calls', 'calls', 3);
    assert.equal(calls.ids.length, 4);
    assert.equal(new Set(calls.ids).size, 4);
  });
});
