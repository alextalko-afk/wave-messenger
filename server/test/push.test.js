import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, emit, sleep } from './helpers.js';

const mockUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fcm-mock.mjs')).href;

describe('push notifications (FCM mocked)', () => {
  let srv, fcmLog, tmp, alice, bob, carol, dm, sa;
  const pushes = () =>
    existsSync(fcmLog) ? readFileSync(fcmLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).message) : [];
  const send = async (conv, content, extra = {}) => {
    await emit(sa, 'message:send', { conversationId: conv.id, content, ...extra });
    await sleep(400);
  };

  before(async () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'wave-fcm-'));
    fcmLog = path.join(tmp, 'fcm.log');
    srv = await startServer({
      nodeArgs: ['--import', mockUrl],
      env: {
        FCM_LOG: fcmLog,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'p', client_email: 'a@b.c', private_key: 'x' }),
      },
    });
    [alice, bob, carol] = await Promise.all([srv.createUser('Alice'), srv.createUser('Bob'), srv.createUser('Carol')]);
    await srv.api('/api/push/register', { method: 'POST', body: { token: 'bob-phone', platform: 'android' }, token: bob.token });
    await srv.api('/api/push/register', { method: 'POST', body: { token: 'carol-phone', platform: 'ios' }, token: carol.token });
    dm = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: bob.id }, token: alice.token })).body.conversation;
    sa = await srv.connect(alice.token);
  });
  after(async () => {
    await srv.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('notifies an offline recipient with a deep-link payload', async () => {
    await send(dm, 'offline hello');
    const p = pushes();
    assert.equal(p.length, 1);
    assert.equal(p[0].token, 'bob-phone');
    assert.deepEqual([p[0].notification.title, p[0].notification.body], ['Alice', 'offline hello']);
    assert.equal(p[0].data.conversationId, dm.id);
  });

  it('skips foreground users but notifies a backgrounded one with an open socket', async () => {
    const sb = await srv.connect(bob.token);
    await sleep(250);
    await send(dm, 'online visible');
    assert.equal(pushes().length, 1);

    sb.emit('app:visibility', { visible: false });
    await sleep(150);
    await send(dm, 'background hello');
    assert.equal(pushes().length, 2);

    sb.emit('app:visibility', { visible: true });
    await sleep(150);
    await send(dm, 'foreground again');
    assert.equal(pushes().length, 2);
    sb.disconnect();
    await sleep(250);
  });

  it('respects muted chats', async () => {
    const count = pushes().length;
    await srv.api(`/api/conversations/${dm.id}/mute`, { method: 'POST', body: { muted: true }, token: bob.token });
    await send(dm, 'muted hello');
    assert.equal(pushes().length, count);
    await srv.api(`/api/conversations/${dm.id}/mute`, { method: 'POST', body: { muted: false }, token: bob.token });
  });

  it('previews media and names groups', async () => {
    await send(dm, '', { fileUrl: '/uploads/a.png', fileType: 'image/png', fileName: 'a.png' });
    assert.equal(pushes().at(-1).notification.body, '📷 Фото');

    const grp = (
      await srv.api('/api/conversations/group', { method: 'POST', body: { name: 'Team', memberIds: [carol.id] }, token: alice.token })
    ).body.conversation;
    await send(grp, 'group msg');
    const last = pushes().at(-1);
    assert.equal(last.token, 'carol-phone');
    assert.deepEqual([last.notification.title, last.notification.body], ['Team', 'Alice: group msg']);

    await srv.api('/api/push/unregister', { method: 'POST', body: { token: 'carol-phone' }, token: carol.token });
    const count = pushes().length;
    await send(grp, 'after unregister');
    assert.equal(pushes().length, count);
  });

  it('validates device registration', async () => {
    assert.equal((await srv.api('/api/push/register', { method: 'POST', body: {}, token: alice.token })).status, 400);
    assert.equal((await srv.api('/api/push/register', { method: 'POST', body: { token: 'x' } })).status, 401);
  });
});
