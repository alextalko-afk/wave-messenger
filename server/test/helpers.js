import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

/**
 * Boots the real server on a free port with a throwaway SQLite database.
 * Phone login with the code in the response (ALLOW_DEV_PHONE_CODE) is how
 * tests create users, since password registration no longer exists.
 */
export async function startServer({ env = {}, nodeArgs = [] } = {}) {
  const port = await freePort();
  const dir = mkdtempSync(path.join(tmpdir(), 'wave-test-'));
  const childEnv = {
    ...process.env,
    PORT: String(port),
    JWT_SECRET: 'test-secret',
    DB_PATH: path.join(dir, 'test.db'),
    TURSO_DATABASE_URL: '',
    CLOUDINARY_CLOUD_NAME: '',
    ALLOW_DEV_PHONE_CODE: '1',
    ...env,
  };
  for (const key of ['FIREBASE_SERVICE_ACCOUNT', 'TURN_URLS', 'TURN_SECRET', 'TURN_USERNAME', 'TURN_CREDENTIAL']) {
    if (!(key in env)) delete childEnv[key];
  }
  const child = spawn('node', [...nodeArgs, 'src/index.js'], { cwd: serverDir, env: childEnv });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }

  const sockets = [];
  const api = async (route, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  let phoneCounter = 0;
  return {
    port,
    base,
    api,
    log: () => log,
    alive: () => child.exitCode === null,
    async createUser(name) {
      const phone = `+7999${String(Date.now() % 1e6).padStart(6, '0')}${phoneCounter++}`;
      const req = await api('/api/auth/phone/request', { method: 'POST', body: { phone } });
      const ver = await api('/api/auth/phone/verify', {
        method: 'POST',
        body: { phone, code: req.body.devCode, displayName: name },
      });
      return { token: ver.body.token, id: ver.body.user.id, name };
    },
    connect(token) {
      return new Promise((resolve, reject) => {
        const s = io(base, { auth: { token }, transports: ['websocket'], forceNew: true });
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
      });
    },
    async stop() {
      sockets.forEach((s) => s.disconnect());
      child.kill();
      await new Promise((r) => (child.exitCode !== null ? r() : child.once('exit', r)));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Emits with an ack; resolves to the ack payload ({ timeout: true } if none). */
export const emit = (socket, event, data) =>
  new Promise((resolve) => {
    socket.timeout(2000).emit(event, data, (err, res) => resolve(err ? { timeout: true } : res));
  });

/** Collects every payload of `event` received on `socket`. */
export function collect(socket, ...events) {
  const received = [];
  for (const event of events) socket.on(event, (payload) => received.push({ event, payload }));
  return received;
}
