import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, emit, collect, sleep } from './helpers.js';

describe('phone login without an SMS gateway', () => {
  let srv;
  before(async () => {
    srv = await startServer({ env: { ALLOW_DEV_PHONE_CODE: '' } });
  });
  after(() => srv.stop());

  it('never returns a code and is disabled', async () => {
    const req = await srv.api('/api/auth/phone/request', { method: 'POST', body: { phone: '+79990000000' } });
    assert.equal(req.status, 503);
    assert.equal(req.body.devCode, undefined);
    const ver = await srv.api('/api/auth/phone/verify', { method: 'POST', body: { phone: '+79990000000', code: '12345' } });
    assert.equal(ver.status, 503);
  });
});

describe('socket permissions', () => {
  let srv, alice, bob, eve, conv, sa, sb, se;
  before(async () => {
    srv = await startServer();
    [alice, bob, eve] = await Promise.all([srv.createUser('Alice'), srv.createUser('Bob'), srv.createUser('Eve')]);
    conv = (await srv.api('/api/conversations/direct', { method: 'POST', body: { userId: bob.id }, token: alice.token })).body.conversation;
    [sa, sb, se] = await Promise.all([srv.connect(alice.token), srv.connect(bob.token), srv.connect(eve.token)]);
  });
  after(() => srv.stop());

  it('lets members send and rejects non-members', async () => {
    assert.ok((await emit(sa, 'message:send', { conversationId: conv.id, content: 'hi' })).message);
    assert.ok((await emit(se, 'message:send', { conversationId: conv.id, content: 'spam' })).error);
  });

  it('validates message content, file urls and replies', async () => {
    const send = (extra) => emit(sa, 'message:send', { conversationId: conv.id, content: 'x', ...extra });
    assert.ok((await send({ fileUrl: 'javascript:alert(1)' })).error);
    assert.ok((await send({ fileUrl: 'data:text/html,x' })).error);
    assert.ok((await send({ content: 'x'.repeat(5001) })).error);
    assert.ok((await send({ replyToId: 'does-not-exist' })).error);
    assert.ok((await send({ fileUrl: '/uploads/a.png' })).message);
    assert.ok((await send({ fileUrl: 'https://res.cloudinary.com/x/a.png' })).message);
  });

  it('only the author can edit, and not to empty text', async () => {
    const { message } = await emit(sa, 'message:send', { conversationId: conv.id, content: 'original' });
    assert.ok((await emit(se, 'message:edit', { messageId: message.id, content: 'hacked' })).error);
    assert.ok((await emit(sb, 'message:edit', { messageId: message.id, content: 'hacked' })).error);
    assert.ok((await emit(sa, 'message:edit', { messageId: message.id, content: '   ' })).error);
    assert.ok((await emit(sa, 'message:edit', { messageId: message.id, content: 'edited' })).ok);
  });

  it('does not relay typing or conversation announcements from non-members', async () => {
    const seen = collect(sb, 'typing:update', 'conversation:new');
    se.emit('typing:start', { conversationId: conv.id });
    se.emit('conversation:created', { conversationId: conv.id, memberIds: [bob.id] });
    await sleep(300);
    assert.deepEqual(seen, []);
  });

  it('restricts call signalling to the call participants', async () => {
    const bobSees = collect(sb, 'call:invite', 'call:end', 'call:answer', 'call:ice-candidate');

    se.emit('call:invite', { targetUserId: bob.id, callId: 'eve-call', kind: 'audio', sdp: {} });
    await sleep(250);
    assert.equal(bobSees.length, 0, 'no invite without a shared conversation');

    sa.emit('call:invite', { targetUserId: bob.id, callId: 'call1', conversationId: conv.id, kind: 'audio', sdp: {} });
    await sleep(250);
    assert.equal(bobSees.filter((e) => e.event === 'call:invite').length, 1);

    bobSees.length = 0;
    se.emit('call:end', { targetUserId: bob.id, callId: 'call1' });
    se.emit('call:ice-candidate', { targetUserId: bob.id, callId: 'call1', candidate: {} });
    sa.emit('call:answer', { targetUserId: bob.id, callId: 'call1', sdp: {} }); // caller can't answer own call
    await sleep(250);
    assert.equal(bobSees.length, 0);

    const aliceSees = collect(sa, 'call:answer');
    sb.emit('call:answer', { targetUserId: alice.id, callId: 'call1', sdp: {} });
    await sleep(250);
    assert.equal(aliceSees.length, 1);
  });

  it('logs a call to an offline user as missed', async () => {
    sb.disconnect();
    await sleep(250);
    sa.emit('call:invite', { targetUserId: bob.id, callId: 'call2', conversationId: conv.id, kind: 'audio', sdp: {} });
    await sleep(300);
    const calls = (await srv.api('/api/calls', { token: bob.token })).body.calls;
    assert.equal(calls.find((c) => c.id === 'call2')?.status, 'missed');
  });

  it('survives malformed payloads and bad JSON', async () => {
    sa.emit('message:send', null);
    sa.emit('message:edit', 5);
    sa.emit('call:invite', 'x');
    sa.emit('typing:start');
    const bad = await fetch(`${srv.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.ok(bad.status >= 400);
    await sleep(250);
    assert.ok(srv.alive());
    assert.equal((await srv.api('/api/health')).status, 200);
  });
});
