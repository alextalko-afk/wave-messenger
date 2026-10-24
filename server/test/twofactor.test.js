import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { base32Encode, totpCode, verifyTotp, otpauthUrl, encryptSecret, decryptSecret } from '../src/totp.js';

process.env.JWT_SECRET ||= 'test-secret';

describe('TOTP primitives', () => {
  // RFC 6238 appendix B (SHA-1); the 6-digit codes are the tails of the 8-digit vectors.
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC 6238 test vectors', () => {
    assert.equal(totpCode(secret, 59_000), '287082');
    assert.equal(totpCode(secret, 1_111_111_109_000), '081804');
    assert.equal(totpCode(secret, 1_234_567_890_000), '005924');
  });

  it('accepts one step of clock drift but not more, and rejects junk', () => {
    const at = 1_111_111_109_000;
    const code = totpCode(secret, at);
    assert.notEqual(verifyTotp(secret, code, { timeMs: at }), null);
    assert.notEqual(verifyTotp(secret, code, { timeMs: at + 30_000 }), null);
    assert.equal(verifyTotp(secret, code, { timeMs: at + 90_000 }), null);
    assert.equal(verifyTotp(secret, '12345', { timeMs: at }), null);
    assert.equal(verifyTotp(secret, 'abcdef', { timeMs: at }), null);
  });

  it('builds an otpauth URL and round-trips encrypted secrets', () => {
    assert.match(otpauthUrl({ secret: 'ABC', account: 'bob smith' }), /^otpauth:\/\/totp\/Wave:bob%20smith\?secret=ABC&issuer=Wave/);
    const stored = encryptSecret(secret);
    assert.notEqual(stored, secret);
    assert.equal(decryptSecret(stored), secret);
  });
});

describe('two-step verification', () => {
  let srv;
  let phone;
  let user;
  let secret;
  let recoveryCodes;

  const auth = (route, { body, token = user.token, method = 'POST' } = {}) => srv.api(route, { method, body, token });
  const signIn = async () => {
    const req = await srv.api('/api/auth/phone/request', { method: 'POST', body: { phone } });
    return srv.api('/api/auth/phone/verify', { method: 'POST', body: { phone, code: req.body.devCode } });
  };
  // Codes for the step after the current one are accepted (clock drift window) and haven't been used yet.
  const nextCode = () => totpCode(secret, Date.now() + 30_000);

  before(async () => {
    srv = await startServer();
    phone = '+79991234567';
    const req = await srv.api('/api/auth/phone/request', { method: 'POST', body: { phone } });
    const ver = await srv.api('/api/auth/phone/verify', { method: 'POST', body: { phone, code: req.body.devCode, displayName: 'Alice' } });
    user = { token: ver.body.token, id: ver.body.user.id };
  });
  after(() => srv.stop());

  it('enabling needs a code from the secret that was handed out', async () => {
    const setup = await auth('/api/auth/2fa/setup');
    assert.equal(setup.status, 200);
    assert.match(setup.body.secret, /^[A-Z2-7]{32}$/);
    assert.match(setup.body.otpauthUrl, /^otpauth:\/\/totp\//);
    secret = setup.body.secret;

    assert.equal((await auth('/api/auth/2fa/enable', { body: { code: '000000' } })).status, 401);
    assert.equal((await auth('/api/auth/2fa/enable', { body: {} })).status, 401);
    assert.equal((await srv.api('/api/auth/2fa/setup', { method: 'POST' })).status, 401, 'needs a session');

    const enable = await auth('/api/auth/2fa/enable', { body: { code: totpCode(secret) } });
    assert.equal(enable.status, 200);
    assert.equal(enable.body.user.twoFactorEnabled, true);
    recoveryCodes = enable.body.recoveryCodes;
    assert.equal(recoveryCodes.length, 10);
    assert.ok(recoveryCodes.every((c) => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)));
    assert.equal((await auth('/api/auth/me', { method: 'GET' })).body.user.twoFactorEnabled, true);
    assert.equal((await auth('/api/auth/2fa/setup')).status, 409, 'already on');
  });

  it('a sign-in now ends in a challenge, not a session', async () => {
    const res = await signIn();
    assert.equal(res.status, 200);
    assert.equal(res.body.twoFactorRequired, true);
    assert.equal(res.body.token, undefined);
    assert.equal(res.body.user, undefined);
    assert.ok(res.body.challengeToken);

    // the challenge is not a credential
    assert.equal((await srv.api('/api/auth/me', { token: res.body.challengeToken })).status, 401);
    assert.equal((await srv.api('/api/conversations', { token: res.body.challengeToken })).status, 401);
    await assert.rejects(srv.connect(res.body.challengeToken), /unauthorized/);
  });

  it('completes with an authenticator code, once', async () => {
    const { body } = await signIn();
    const wrong = await srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken: body.challengeToken, code: '123456' } });
    assert.equal(wrong.status, 401);

    const code = nextCode();
    const ok = await srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken: body.challengeToken, code } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.id, user.id);
    assert.equal((await srv.api('/api/auth/me', { token: ok.body.token })).status, 200);

    const replay = await srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken: body.challengeToken, code } });
    assert.equal(replay.status, 401, 'the same code cannot be used twice');
    const enableCode = await srv.api('/api/auth/2fa/verify', {
      method: 'POST',
      body: { challengeToken: body.challengeToken, code: totpCode(secret) },
    });
    assert.equal(enableCode.status, 401, 'the code that switched 2FA on is spent too');
  });

  it('rejects forged, expired-looking and wrong-purpose challenges', async () => {
    const verify = (challengeToken) =>
      srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken, code: recoveryCodes[0] } });
    assert.equal((await verify('nonsense')).status, 401);
    assert.equal((await verify(undefined)).status, 401);
    // a normal session token is not a challenge
    assert.equal((await verify(user.token)).status, 401);
  });

  it('recovery codes work once each', async () => {
    const { body } = await signIn();
    const verify = (code) => srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken: body.challengeToken, code } });
    const first = await verify(recoveryCodes[0].toUpperCase().replace('-', ' - '));
    assert.equal(first.status, 200, 'case and separators do not matter');
    assert.equal((await verify(recoveryCodes[0])).status, 401, 'burnt after use');
    assert.equal((await auth('/api/auth/2fa/recovery-codes/remaining', { method: 'GET' })).body.remaining, 9);
  });

  it('locks the second step after repeated wrong codes', async () => {
    const { body } = await signIn();
    const verify = (code) => srv.api('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken: body.challengeToken, code } });
    // misses from the earlier tests still count, so the lock lands within five tries
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await verify('111111')).status);
    assert.ok(statuses.every((s) => s === 401 || s === 429), statuses.join());
    assert.equal(statuses.at(-1), 429);
    assert.equal((await verify(recoveryCodes[1])).status, 429, 'even a valid recovery code waits out the lock');
  });

  it('the lock also holds for turning the feature off', async () => {
    const stillLocked = await auth('/api/auth/2fa/disable', { body: { code: recoveryCodes[1] } });
    assert.equal(stillLocked.status, 429);
  });
});

describe('two-step verification: disabling and regenerating', () => {
  let srv;
  let user;
  let secret;
  let phone;
  let codes;
  const auth = (route, body, method = 'POST') => srv.api(route, { method, body, token: user.token });

  before(async () => {
    srv = await startServer();
    phone = '+79997654321';
    const req = await srv.api('/api/auth/phone/request', { method: 'POST', body: { phone } });
    const ver = await srv.api('/api/auth/phone/verify', { method: 'POST', body: { phone, code: req.body.devCode, displayName: 'Bob' } });
    user = { token: ver.body.token, id: ver.body.user.id };
    secret = (await auth('/api/auth/2fa/setup')).body.secret;
    codes = (await auth('/api/auth/2fa/enable', { code: totpCode(secret) })).body.recoveryCodes;
  });
  after(() => srv.stop());

  it('regenerating recovery codes needs a code and invalidates the old set', async () => {
    assert.equal((await auth('/api/auth/2fa/recovery-codes', { code: '000000' })).status, 401);
    const fresh = await auth('/api/auth/2fa/recovery-codes', { code: codes[0] });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.recoveryCodes.length, 10);
    assert.equal((await auth('/api/auth/2fa/recovery-codes/remaining', undefined, 'GET')).body.remaining, 10);
    // the old codes no longer exist
    const reuse = await auth('/api/auth/2fa/disable', { code: codes[1] });
    assert.equal(reuse.status, 401);
    codes = fresh.body.recoveryCodes;
  });

  it('disables with a valid code and then sign-in returns a session directly', async () => {
    assert.equal((await auth('/api/auth/2fa/disable', { code: '999999' })).status, 401);
    const off = await auth('/api/auth/2fa/disable', { code: codes[0] });
    assert.equal(off.status, 200);
    assert.equal(off.body.user.twoFactorEnabled, false);

    const req = await srv.api('/api/auth/phone/request', { method: 'POST', body: { phone } });
    const again = await srv.api('/api/auth/phone/verify', { method: 'POST', body: { phone, code: req.body.devCode } });
    assert.ok(again.body.token, 'no challenge once disabled');
    assert.equal(again.body.twoFactorRequired, undefined);
    assert.equal((await auth('/api/auth/2fa/disable', { code: codes[1] })).status, 409, 'nothing left to disable');
  });
});
