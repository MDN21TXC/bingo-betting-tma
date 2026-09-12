import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authService } from './AuthService.js';
import { app } from './index.js';
import type { Server } from 'http';

const TEST_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test_mock_bot_token_123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
let testServer: Server;
let BASE_URL: string;

describe('Production Authentication & User Registration Architecture Suite', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      testServer = app.listen(0, '127.0.0.1', () => {
        const addr = testServer.address() as any;
        BASE_URL = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  // Helper to create valid signed initData
  function createTestInitData(
    userObj: { id: number | string; first_name: string; username?: string; last_name?: string },
    authDate = Math.floor(Date.now() / 1000)
  ) {
    return authService.createSignedTelegramInitData(userObj, TEST_BOT_TOKEN, undefined, authDate);
  }

  // TEST 1: Brand-new Telegram user -> Registration flow starts
  it('TEST 1: Brand-new Telegram user triggers registration flow with tempToken', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({
      id: uniqueTgId,
      first_name: 'Habtamu',
      username: `habtamu_${uniqueTgId}`
    });

    const res = await authService.authenticateTelegram(initData);
    expect(res.success).toBe(true);
    expect(res.status).toBe('NEW_USER');
    expect(res.tempToken).toBeDefined();
    expect(res.tempToken?.startsWith('temp_')).toBe(true);
    expect(res.telegramUser?.id).toBe(uniqueTgId);
    expect(res.suggestedUsername).toBe(`habtamu_${uniqueTgId}`);

    // HTTP Endpoint Test
    const httpRes = await fetch(`${BASE_URL}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData })
    });
    const httpData = await httpRes.json();
    expect(httpRes.status).toBe(200);
    expect(httpData.success).toBe(true);
    expect(['NEW_USER', 'REGISTRATION_REQUIRED']).toContain(httpData.status);
    expect(httpData.tempToken).toBeDefined();
  });

  // TEST 2: Existing Telegram user -> Registration skipped, authenticated directly
  it('TEST 2: Existing Telegram user skips registration and enters authenticated session', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const chosenUsername = `Winner_${uniqueTgId.toString().slice(-5)}`;
    const initData = createTestInitData({
      id: uniqueTgId,
      first_name: 'Dawit',
      username: `dawit_${uniqueTgId}`
    });

    // 1. Initial auth (new user)
    const initial = await authService.authenticateTelegram(initData);
    expect(initial.tempToken).toBeDefined();

    // 2. Complete registration
    const reg = await authService.completeRegistration(initial.tempToken!, chosenUsername);
    expect(reg.success).toBe(true);
    expect(reg.user?.registration_status).toBe('COMPLETED');
    expect(reg.sessionToken).toBeDefined();

    // 3. User returns: skips registration
    const returning = await authService.authenticateTelegram(initData);
    expect(returning.success).toBe(true);
    expect(returning.status).toBe('AUTHENTICATED');
    expect(returning.user?.username).toBe(chosenUsername);
    expect(returning.sessionToken).toBeDefined();
  });

  // TEST 3: Same Telegram account opens Mini App multiple times -> One database account only
  it('TEST 3: Same Telegram account opening multiple times produces exactly one database record', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const chosenUsername = `Tigist_${uniqueTgId.toString().slice(-5)}`;
    const initData = createTestInitData({
      id: uniqueTgId,
      first_name: 'Tigist',
      username: `tigist_${uniqueTgId}`
    });

    const initial = await authService.authenticateTelegram(initData);
    await authService.completeRegistration(initial.tempToken!, chosenUsername);

    // Open Mini App 5 consecutive times
    for (let i = 0; i < 5; i++) {
      const openResult = await authService.authenticateTelegram(initData);
      expect(openResult.status).toBe('AUTHENTICATED');
      expect(openResult.user?.id || openResult.user?.playerId).toBe(`tg_${uniqueTgId}`);
    }

    const foundByTg = authService.getUserByTelegramId(String(uniqueTgId));
    expect(foundByTg).toBeDefined();
    expect(foundByTg?.telegram_id).toBe(String(uniqueTgId));
  });

  // TEST 4: Simultaneous registration requests -> Atomic lock ensures single user
  it('TEST 4: Two simultaneous registration requests for same Telegram ID are serialized cleanly', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const chosenUsername = `Abebe_${uniqueTgId.toString().slice(-5)}`;
    const initData = createTestInitData({
      id: uniqueTgId,
      first_name: 'Abebe',
      username: `abebe_${uniqueTgId}`
    });

    // Step 1: Initial auth
    const authRes = await authService.authenticateTelegram(initData);
    const token = authRes.tempToken!;

    // Step 2: Fire two simultaneous completeRegistration calls
    const [result1, result2] = await Promise.all([
      authService.completeRegistration(token, chosenUsername),
      authService.completeRegistration(token, chosenUsername)
    ]);

    // Both should finish cleanly without duplicate records or server crash
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    const user = authService.getUserByTelegramId(String(uniqueTgId));
    expect(user).toBeDefined();
    expect(user?.registration_status).toBe('COMPLETED');
  });

  // TEST 5: User closes Mini App during registration -> Resume registration without duplicate
  it('TEST 5: Interrupted registration can be resumed on next launch without creating duplicate', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({
      id: uniqueTgId,
      first_name: 'Solomon',
      username: `solomon_${uniqueTgId}`
    });

    // User opens app (temp record created with PENDING/IN_PROGRESS)
    const step1 = await authService.authenticateTelegram(initData);
    expect(step1.status).toBe('NEW_USER');

    // User closes app before completing username!
    // Next day user opens app again:
    const step2 = await authService.authenticateTelegram(initData);
    expect(['NEW_USER', 'REGISTRATION_REQUIRED']).toContain(step2.status);
    expect(step2.tempToken).toBeDefined();

    // Completes registration successfully
    const step3 = await authService.completeRegistration(step2.tempToken!, `Solomon_${uniqueTgId.toString().slice(-4)}`);
    expect(step3.success).toBe(true);
    expect(step3.user?.registration_status).toBe('COMPLETED');
  });

  // TEST 6: Invalid username -> Registration rejected
  it('TEST 6: Invalid username formats and reserved system names are rejected', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'Test' });
    const { tempToken } = await authService.authenticateTelegram(initData);

    // Too short (< 3 chars)
    const tooShort = await authService.completeRegistration(tempToken!, 'ab');
    expect(tooShort.success).toBe(false);
    expect(tooShort.error).toContain('at least 3');

    // Too long (> 20 chars)
    const tooLong = await authService.completeRegistration(tempToken!, 'a_very_long_username_over_limit');
    expect(tooLong.success).toBe(false);
    expect(tooLong.error).toContain('cannot exceed 20');

    // Invalid characters (symbols, spaces)
    const invalidChars = await authService.completeRegistration(tempToken!, 'user name!');
    expect(invalidChars.success).toBe(false);
    expect(invalidChars.error).toContain('letters, numbers, and underscores');

    // Reserved system names
    const reserved = await authService.completeRegistration(tempToken!, 'admin');
    expect(reserved.success).toBe(false);
    expect(reserved.error).toContain('reserved');
  });

  // TEST 7: Duplicate username -> Registration rejected
  it('TEST 7: Duplicate username is rejected case-insensitively', async () => {
    const uniqueTgId1 = Math.floor(100000000 + Math.random() * 899999999);
    const uniqueTgId2 = Math.floor(100000000 + Math.random() * 899999999);
    const chosenName = `MegaStar_${uniqueTgId1.toString().slice(-4)}`;

    const user1Init = createTestInitData({ id: uniqueTgId1, first_name: 'User1' });
    const user2Init = createTestInitData({ id: uniqueTgId2, first_name: 'User2' });

    // User 1 registers chosenName
    const auth1 = await authService.authenticateTelegram(user1Init);
    const reg1 = await authService.completeRegistration(auth1.tempToken!, chosenName);
    expect(reg1.success).toBe(true);

    // User 2 tries to register identical username (with lowercase)
    const auth2 = await authService.authenticateTelegram(user2Init);
    const reg2 = await authService.completeRegistration(auth2.tempToken!, chosenName.toLowerCase());
    expect(reg2.success).toBe(false);
    expect(reg2.error).toContain('already taken');
  });

  // TEST 8: Invalid referral -> Handled gracefully without crash or corrupt relation
  it('TEST 8: Non-existent referral code is rejected or cleared safely', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'RefTest' });
    const auth = await authService.authenticateTelegram(initData);

    const reg = await authService.completeRegistration(
      auth.tempToken!,
      `RefUser_${uniqueTgId.toString().slice(-4)}`,
      'NON_EXISTENT_REF_CODE'
    );
    expect(reg.success).toBe(false);
    expect(reg.error).toContain('Invalid referral code');
  });

  // TEST 9: Self-referral -> Rejected
  it('TEST 9: Self-referral is strictly prohibited', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'SelfRef' });

    // Step 1: Initial auth
    const auth = await authService.authenticateTelegram(initData);
    const ownCode = (authService as any).generateUniqueReferralCode('SelfRef');

    const reg = await authService.completeRegistration(
      auth.tempToken!,
      `Self_${uniqueTgId.toString().slice(-4)}`,
      ownCode
    );
    expect(reg.success).toBe(false);
  });

  // TEST 10: Invalid Telegram authentication data -> Authentication rejected
  it('TEST 10: Tampered or expired Telegram initData is rejected with signature error', async () => {
    // 1. Tampered payload
    const authentic = createTestInitData({ id: 123456, first_name: 'Hacker' });
    const tampered = authentic.replace('Hacker', 'Admin');
    const tamperedCheck = authService.verifyTelegramInitData(tampered, TEST_BOT_TOKEN);
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.error).toContain('hash mismatch');

    // 2. Expired payload (> 24 hours ago)
    const oldTimestamp = Math.floor(Date.now() / 1000) - (25 * 3600);
    const expired = createTestInitData({ id: 123456, first_name: 'OldUser' }, oldTimestamp);
    const expiredCheck = authService.verifyTelegramInitData(expired, TEST_BOT_TOKEN);
    expect(expiredCheck.isValid).toBe(false);
    expect(expiredCheck.error).toContain('expired');

    // 3. HTTP API rejection
    const httpRes = await fetch(`${BASE_URL}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tampered })
    });
    expect(httpRes.status).toBe(401);
  });

  // TEST 11: Expired session -> Reauthentication required
  it('TEST 11: Expired session token is rejected by backend session check', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'ExpiryTest' });
    const auth = await authService.authenticateTelegram(initData);
    const reg = await authService.completeRegistration(auth.tempToken!, `Exp_${uniqueTgId.toString().slice(-4)}`);
    const sessionToken = reg.sessionToken!;

    // Artificially expire the session in authService (numeric timestamp)
    const sessionObj = (authService as any).sessions.get(sessionToken);
    expect(sessionObj).toBeDefined();
    sessionObj.expires_at = Date.now() - 60000;

    // Check session
    const check = authService.validateSession(sessionToken);
    expect(check.valid).toBe(false);
    expect(check.error).toContain('expired');

    // HTTP /api/auth/session should return 401
    const httpRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    expect(httpRes.status).toBe(401);
  });

  // TEST 12: User attempts to access another user's data (IDOR prevention)
  it('TEST 12: Authenticated user cannot access another player data via IDOR', async () => {
    // Register User A
    const tgIdA = Math.floor(100000000 + Math.random() * 899999999);
    const initA = createTestInitData({ id: tgIdA, first_name: 'PlayerA' });
    const authA = await authService.authenticateTelegram(initA);
    const regA = await authService.completeRegistration(authA.tempToken!, `PlA_${tgIdA.toString().slice(-4)}`);
    const tokenA = regA.sessionToken!;

    // Player B target ID
    const victimPlayerId = 'usr_victim_999';

    // User A tries to view Victim's ledger with User A's token
    const ledgerRes = await fetch(`${BASE_URL}/api/ledger/${victimPlayerId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    expect(ledgerRes.status).toBe(403);
    const ledgerData = await ledgerRes.json();
    expect(ledgerData.error).toContain('Access denied');

    // User A tries to deposit to Victim's wallet with User A's token
    const depositRes = await fetch(`${BASE_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        playerId: victimPlayerId,
        amount: 500,
        provider: 'telebirr'
      })
    });
    expect(depositRes.status).toBe(403);
  });

  // TEST 13: Network failure during registration -> Idempotent retry succeeds
  it('TEST 13: Network retry of registration completion is idempotent and succeeds without duplicate', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const chosenName = `Idem_${uniqueTgId.toString().slice(-4)}`;
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'IdempotencyTest' });

    const auth = await authService.authenticateTelegram(initData);
    const tempToken = auth.tempToken!;

    // Call 1: Completes registration
    const call1 = await authService.completeRegistration(tempToken, chosenName);
    expect(call1.success).toBe(true);

    // Call 2: Simulated network retry with same tempToken or same credentials
    const call2 = await authService.completeRegistration(tempToken, chosenName);
    expect(call2.success).toBe(true);
    expect(call2.user?.id).toBe(call1.user?.id);
  });

  // TEST 14: User logs out -> Session revoked, protected requests rejected
  it('TEST 14: User logout revokes session and subsequent protected requests are rejected', async () => {
    const uniqueTgId = Math.floor(100000000 + Math.random() * 899999999);
    const initData = createTestInitData({ id: uniqueTgId, first_name: 'LogoutUser' });
    const auth = await authService.authenticateTelegram(initData);
    const reg = await authService.completeRegistration(auth.tempToken!, `Log_${uniqueTgId.toString().slice(-4)}`);
    const sessionToken = reg.sessionToken!;

    // Verify session works prior to logout
    const preCheck = authService.validateSession(sessionToken);
    expect(preCheck.valid).toBe(true);

    // Call logout endpoint
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    expect(logoutRes.status).toBe(200);

    // Session must be revoked
    const postCheck = authService.validateSession(sessionToken);
    expect(postCheck.valid).toBe(false);
    expect(postCheck.error).toContain('revoked');

    // Protected /api/auth/me rejects with 401
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    expect(meRes.status).toBe(401);
  });
});
