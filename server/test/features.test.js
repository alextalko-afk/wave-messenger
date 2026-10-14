import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { startServer, emit, collect, sleep } from './helpers.js';

describe('delivery receipts', () => {
  let srv, alice, bob, conv, sa;
  const lastDelivered = async () =>
    (await srv.api('/api/conversations', { token: alice.token })).body.conversations[0].members.find((m) => m.id === bob.id)
      .lastDeliveredAt;

  before(async () => {
    srv = await startServer();
    [alice, bob] = await Promise.all([srv.createUser('Alice'), srv.createUser('Bob')]);
    conv = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: bob.id }, token: alice.token })).body.conversation;
    sa = await srv.connect(alice.token);
  });
  after(() => srv.stop());

  it('is not delivered while the recipient is offline, then is when they connect', async () => {
    const events = collect(sa, 'message:delivered');
    const { message } = await emit(sa, 'message:send', { conversationId: conv.id, content: 'hello offline' });
    await sleep(250);
    assert.equal(events.length, 0);
    assert.equal(await lastDelivered(), 0);

    const sb = await srv.connect(bob.token);
    await sleep(500);
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.userId, bob.id);
    assert.ok(events[0].payload.deliveredAt >= message.createdAt);
    assert.ok((await lastDelivered()) >= message.createdAt);

    // a second device of an already-online user doesn't re-announce
    const bobSees = collect(sb, 'message:delivered');
    await srv.connect(bob.token);
    await sleep(250);
    assert.equal(bobSees.length, 0);
  });

  it('is delivered immediately when the recipient is online', async () => {
    const events = collect(sa, 'message:delivered');
    const { message } = await emit(sa, 'message:send', { conversationId: conv.id, content: 'hello online' });
    await sleep(300);
    const delivered = events.find((e) => e.event === 'message:delivered');
    assert.ok(delivered && delivered.payload.deliveredAt >= message.createdAt);
  });
});

describe('replies, reactions and search', () => {
  let srv, alice, bob, eve, conv, sa, sb, se, m1, m2;
  before(async () => {
    srv = await startServer();
    [alice, bob, eve] = await Promise.all([srv.createUser('Алиса'), srv.createUser('Боб'), srv.createUser('Ева')]);
    conv = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: bob.id }, token: alice.token })).body.conversation;
    [sa, sb, se] = await Promise.all([srv.connect(alice.token), srv.connect(bob.token), srv.connect(eve.token)]);
    m1 = (await emit(sa, 'message:send', { conversationId: conv.id, content: 'Привет, как дела? Встреча в ПЯТНИЦУ' })).message;
    m2 = (await emit(sb, 'message:send', { conversationId: conv.id, content: 'Отлично!', replyToId: m1.id })).message;
  });
  after(() => srv.stop());

  const history = async (token = alice.token) =>
    (await srv.api(`/api/conversations/${conv.id}/messages`, { token })).body.messages;

  it('includes the reply preview on send and in history', async () => {
    assert.equal(m2.replyToSenderName, 'Алиса');
    assert.ok(m2.replyToContent.startsWith('Привет'));
    const h2 = (await history()).find((m) => m.id === m2.id);
    assert.equal(h2.replyToSenderName, 'Алиса');
    assert.ok(h2.replyToContent.includes('ПЯТНИЦУ'));
  });

  it('toggles, replaces and groups reactions, broadcasting each change', async () => {
    const seen = collect(sa, 'message:reactions');
    let r = await emit(sb, 'message:react', { messageId: m1.id, emoji: '👍' });
    assert.deepEqual(r.reactions, [{ emoji: '👍', userIds: [bob.id] }]);
    r = await emit(sa, 'message:react', { messageId: m1.id, emoji: '👍' });
    assert.equal(r.reactions[0].userIds.length, 2);
    r = await emit(sa, 'message:react', { messageId: m1.id, emoji: '🔥' }); // replaces own 👍
    assert.equal(r.reactions.find((x) => x.emoji === '👍').userIds.length, 1);
    assert.equal(r.reactions.find((x) => x.emoji === '🔥').userIds.length, 1);
    r = await emit(sa, 'message:react', { messageId: m1.id, emoji: '🔥' }); // toggles off
    assert.ok(!r.reactions.some((x) => x.emoji === '🔥'));
    await sleep(200);
    assert.equal(seen.length, 4);

    const h1 = (await history()).find((m) => m.id === m1.id);
    assert.deepEqual(h1.reactions, [{ emoji: '👍', userIds: [bob.id] }]);
  });

  it('rejects reactions from outsiders, off-list emoji and unknown messages', async () => {
    assert.ok((await emit(se, 'message:react', { messageId: m1.id, emoji: '👍' })).error);
    assert.ok((await emit(sa, 'message:react', { messageId: m1.id, emoji: '💩' })).error);
    assert.ok((await emit(sa, 'message:react', { messageId: 'nope', emoji: '👍' })).error);
  });

  const search = (q, token, extra = '') =>
    srv.api(`/api/search/messages?q=${encodeURIComponent(q)}${extra}`, { token }).then((r) => r.body.results);

  it("searches Cyrillic case-insensitively, scoped to the caller's chats", async () => {
    const hits = await search('пятниц', alice.token);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, m1.id);
    assert.equal((await search('ПРИВЕТ', bob.token)).length, 1);
    assert.equal((await search('пятниц', eve.token)).length, 0);
    assert.equal((await search('п', alice.token)).length, 0);
    assert.equal((await search('привет', alice.token, `&conversationId=${conv.id}`)).length, 1);
    assert.equal((await search('привет', alice.token, '&conversationId=other')).length, 0);
    assert.equal((await srv.api('/api/search/messages?q=привет')).status, 401);
  });

  it('finds users regardless of Cyrillic case', async () => {
    const res = await srv.api(`/api/users/search?q=${encodeURIComponent('алис')}`, { token: bob.token });
    assert.ok(res.body.users.some((u) => u.displayName === 'Алиса'));
  });

  it('hides cleared history from search but not from the other member', async () => {
    await srv.api(`/api/conversations/${conv.id}/clear`, { method: 'POST', token: bob.token });
    assert.equal((await search('отлично', bob.token)).length, 0);
    assert.equal((await search('отлично', alice.token)).length, 1);
  });

  it('drops reactions and search hits when a message is deleted', async () => {
    await emit(sa, 'message:delete', { messageId: m1.id });
    assert.deepEqual((await history()).find((m) => m.id === m1.id).reactions, []);
    assert.equal((await search('пятниц', alice.token)).length, 0);
    assert.ok((await emit(sb, 'message:react', { messageId: m1.id, emoji: '👍' })).error);
  });
});

describe('ICE servers', () => {
  const iceFor = async (env) => {
    const srv = await startServer({ env });
    try {
      const user = await srv.createUser('U');
      const res = await srv.api('/api/calls/ice-servers', { token: user.token });
      const anon = await srv.api('/api/calls/ice-servers');
      return { user, servers: res.body.iceServers, anonStatus: anon.status };
    } finally {
      await srv.stop();
    }
  };

  it('defaults to STUN only and requires auth', async () => {
    const { servers, anonStatus } = await iceFor({});
    assert.equal(anonStatus, 401);
    assert.ok(servers.length >= 1 && servers.every((s) => String(s.urls).startsWith('stun:')));
  });

  it('issues ephemeral coturn credentials when TURN_SECRET is set', async () => {
    const { user, servers } = await iceFor({ TURN_URLS: 'turn:t.example:3478, turns:t.example:5349', TURN_SECRET: 'sharedsecret' });
    const turn = servers.find((s) => s.username);
    assert.deepEqual(turn.urls, ['turn:t.example:3478', 'turns:t.example:5349']);
    assert.equal(turn.credential, createHmac('sha1', 'sharedsecret').update(turn.username).digest('base64'));
    assert.ok(turn.username.endsWith(`:${user.id}`));
    assert.ok(Number(turn.username.split(':')[0]) > Date.now() / 1000);
  });

  it('supports static TURN credentials', async () => {
    const { servers } = await iceFor({ TURN_URLS: 'turn:t.example:3478', TURN_USERNAME: 'bob', TURN_CREDENTIAL: 'pw' });
    assert.ok(servers.some((s) => s.username === 'bob' && s.credential === 'pw'));
  });
});
