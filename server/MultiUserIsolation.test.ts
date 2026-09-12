import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { httpServer, app, multiRoomManager } from './index.js';
import { authService } from './AuthService.js';
import { ledgerService } from './LedgerService.js';
import type { Server } from 'http';

const TEST_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test_mock_bot_token_123456:ABCdefGHIjklMNOpqrSTUvwxYZ';
let serverPort: number;
let BASE_URL: string;

describe('Multi-User State & Identity Isolation Test Suite', () => {
  let socketA: ClientSocketType;
  let socketB: ClientSocketType;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as any;
        serverPort = addr.port;
        BASE_URL = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });

    // 1. Register User A with unique Telegram ID
    const tgIdA = Math.floor(771000000 + Math.random() * 899999);
    const initDataA = authService.createSignedTelegramInitData(
      { id: tgIdA, first_name: 'PlayerAlpha', username: `alpha_${tgIdA}` },
      TEST_BOT_TOKEN
    );
    const authResA = await authService.authenticateTelegram(initDataA);
    const regResA = await authService.completeRegistration(
      authResA.tempToken!,
      `AlphaUser_${tgIdA.toString().slice(-4)}`
    );
    expect(regResA.success).toBe(true);
    userA = regResA.user;
    tokenA = regResA.sessionToken!;

    // 2. Register User B with completely different Telegram ID
    const tgIdB = Math.floor(772000000 + Math.random() * 899999);
    const initDataB = authService.createSignedTelegramInitData(
      { id: tgIdB, first_name: 'PlayerBeta', username: `beta_${tgIdB}` },
      TEST_BOT_TOKEN
    );
    const authResB = await authService.authenticateTelegram(initDataB);
    const regResB = await authService.completeRegistration(
      authResB.tempToken!,
      `BetaUser_${tgIdB.toString().slice(-4)}`
    );
    expect(regResB.success).toBe(true);
    userB = regResB.user;
    tokenB = regResB.sessionToken!;

    // Credit both users with initial test balance
    await ledgerService.recordTransaction(userA.playerId, 'deposit', 500, 'Initial test balance A');
    await ledgerService.recordTransaction(userB.playerId, 'deposit', 500, 'Initial test balance B');
  });

  afterAll(async () => {
    if (socketA?.connected) socketA.disconnect();
    if (socketB?.connected) socketB.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  // TEST 1: Identity Resolution - Two Telegram IDs MUST produce distinct internal IDs
  it('1. TRACE USER IDENTITY: Telegram Account A & B produce strictly distinct internal users', async () => {
    expect(userA.playerId).toBeDefined();
    expect(userB.playerId).toBeDefined();
    expect(userA.playerId).not.toBe(userB.playerId);
    expect(userA.telegram_id).not.toBe(userB.telegram_id);

    // Verify verifying sessions through AuthService
    const sessionA = authService.getUserByToken(tokenA);
    const sessionB = authService.getUserByToken(tokenB);
    expect(sessionA?.playerId).toBe(userA.playerId);
    expect(sessionB?.playerId).toBe(userB.playerId);
    expect(sessionA?.playerId).not.toBe(sessionB?.playerId);

    // /api/auth/me returns each user's own identity based strictly on Bearer token
    const resA = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const dataA = await resA.json();
    expect(dataA.user.playerId).toBe(userA.playerId);

    const resB = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const dataB = await resB.json();
    expect(dataB.user.playerId).toBe(userB.playerId);
  });

  // TEST 2: Wallet and Balance isolation - Financial operations resolve strictly from session
  it('2. BALANCE IS USER-SCOPED: User cannot manipulate another user balance by spoofing playerId', async () => {
    const balBeforeA = authService.getUserByToken(tokenA)!.walletBalance;
    const balBeforeB = authService.getUserByToken(tokenB)!.walletBalance;

    // Attempt deposit using User A's token but passing User B's playerId in body
    const spoofDepositRes = await fetch(`${BASE_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        playerId: userB.playerId, // Malicious spoof
        amount: 150,
        provider: 'telebirr'
      })
    });
    expect(spoofDepositRes.status).toBe(403);
    const spoofData = await spoofDepositRes.json();
    expect(spoofData.error).toMatch(/access denied/i);

    // User A and User B balances are completely unchanged
    expect(authService.getUserByToken(tokenA)!.walletBalance).toBe(balBeforeA);
    expect(authService.getUserByToken(tokenB)!.walletBalance).toBe(balBeforeB);

    // Legitimate deposit for User A
    const legitRes = await fetch(`${BASE_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        amount: 150,
        provider: 'telebirr'
      })
    });
    expect(legitRes.status).toBe(200);
    const legitData = await legitRes.json();
    expect(legitData.user.playerId).toBe(userA.playerId);
    expect(legitData.user.walletBalance).toBe(balBeforeA + 150);

    // User B's balance remains strictly untouched
    const checkB = await fetch(`${BASE_URL}/api/user/${userB.playerId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const dataB = await checkB.json();
    expect(dataB.user.walletBalance).toBe(balBeforeB);
  });

  // TEST 3: WebSocket Connection Authentication & State Binding
  it('3. WEBSOCKET SESSION BINDING: Connections are strictly bound to authenticated user', async () => {
    socketA = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      auth: { token: tokenA },
      transports: ['websocket']
    });
    socketB = ClientSocket(`http://127.0.0.1:${serverPort}`, {
      auth: { token: tokenB },
      transports: ['websocket']
    });

    await Promise.all([
      new Promise<void>((resolve) => socketA.on('connect', () => resolve())),
      new Promise<void>((resolve) => socketB.on('connect', () => resolve()))
    ]);

    expect(socketA.connected).toBe(true);
    expect(socketB.connected).toBe(true);

    // Both join the same room
    await new Promise<void>((resolve) => {
      socketA.emit('JOIN_ROOM', { roomId: 'room_20birr' }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      socketB.emit('JOIN_ROOM', { roomId: 'room_20birr' }, () => resolve());
    });
  });

  // TEST 4: Card Selection Isolation - User B cannot touch User A's cards
  it('4. GAME STATE USER-SCOPED: User A selects card 10; User B cannot deselect it', async () => {
    // User A selects card 10
    const selectResA = await new Promise<any>((resolve) => {
      socketA.emit(
        'SELECT_CARD_NUMBER',
        { roomId: 'room_20birr', cardNumber: 10 },
        (res: any) => resolve(res)
      );
    });
    expect(selectResA.success).toBe(true);
    expect(selectResA.user.playerId).toBe(userA.playerId);

    // User B attempts to select card 10 (already taken by User A)
    const selectResB = await new Promise<any>((resolve) => {
      socketB.emit(
        'SELECT_CARD_NUMBER',
        { roomId: 'room_20birr', cardNumber: 10 },
        (res: any) => resolve(res)
      );
    });
    expect(selectResB.success).toBe(false);
    expect(selectResB.error).toMatch(/already taken/i);

    // User B attempts to DESELECT User A's card 10 (spoofing or attacking)
    const deselectAttack = await new Promise<any>((resolve) => {
      socketB.emit(
        'DESELECT_CARD_NUMBER',
        { roomId: 'room_20birr', cardNumber: 10 },
        (res: any) => resolve(res)
      );
    });
    expect(deselectAttack.success).toBe(false);
    expect(deselectAttack.error).toMatch(/not found or not owned/i);

    // User B selects card 20 legitimately
    const selectResB2 = await new Promise<any>((resolve) => {
      socketB.emit(
        'SELECT_CARD_NUMBER',
        { roomId: 'room_20birr', cardNumber: 20 },
        (res: any) => resolve(res)
      );
    });
    expect(selectResB2.success).toBe(true);
    expect(selectResB2.user.playerId).toBe(userB.playerId);

    // Verify room tickets maintain exact player ownership
    const room = multiRoomManager.getRoom('room_20birr');
    const ticket10 = Array.from(room?.tickets.values() || []).find((t: any) => t.cardNumber === 10);
    const ticket20 = Array.from(room?.tickets.values() || []).find((t: any) => t.cardNumber === 20);

    expect(ticket10?.playerId).toBe(userA.playerId);
    expect(ticket20?.playerId).toBe(userB.playerId);
  });

  // TEST 5: Winner and Reward Isolation - Claiming and Payouts belong ONLY to the winner
  it('5. REWARD IS USER-SCOPED: User A winning awards payout ONLY to User A; User B balance is unchanged', async () => {
    const room = multiRoomManager.getRoom('room_20birr');
    expect(room).toBeDefined();

    const ticketA = Array.from(room!.tickets.values()).find((t: any) => t.cardNumber === 10);
    expect(ticketA).toBeDefined();

    // Simulate drawing all numbers on ticketA to guarantee a winning full house / line
    const numbersOnCardA: number[] = [
      ...ticketA!.grid.B,
      ...ticketA!.grid.I,
      ...ticketA!.grid.N,
      ...ticketA!.grid.G,
      ...ticketA!.grid.O
    ].filter((n) => n > 0);

    room!.status = 'active';
    (room as any).shuffledBalls = numbersOnCardA;
    (room as any).currentBallIndex = numbersOnCardA.length;

    // User B attempts to claim BINGO on User A's ticket
    const fraudClaim = await new Promise<any>((resolve) => {
      socketB.emit(
        'CLAIM_BINGO',
        { roomId: 'room_20birr', ticketId: ticketA!.ticketId },
        (res: any) => resolve(res)
      );
    });
    expect(fraudClaim.success).toBe(false);
    expect(fraudClaim.message).toMatch(/unauthorized ticket claim|not belong to player/i);

    const balanceBeforeA = (authService.getUserByToken(tokenA))!.walletBalance;
    const balanceBeforeB = (authService.getUserByToken(tokenB))!.walletBalance;

    // User A claims legitimate BINGO
    const legitClaim = await new Promise<any>((resolve) => {
      socketA.emit(
        'CLAIM_BINGO',
        { roomId: 'room_20birr', ticketId: ticketA!.ticketId },
        (res: any) => resolve(res)
      );
    });
    expect(legitClaim.success).toBe(true);
    expect(legitClaim.user.playerId).toBe(userA.playerId);
    const payout = legitClaim.winnerRecord.payoutAmount;
    expect(payout).toBeGreaterThan(0);
    expect(legitClaim.user.walletBalance).toBe(balanceBeforeA + payout);

    // Verify User B's balance did NOT change
    const userBAfter = authService.getUserByToken(tokenB);
    expect(userBAfter?.walletBalance).toBe(balanceBeforeB);

    // Verify Ledger history: User A has win_payout transaction; User B has NO win transaction
    const historyA = ledgerService.getLedgerForUser(userA.playerId);
    const historyB = ledgerService.getLedgerForUser(userB.playerId);

    const winEntryA = historyA.find((tx) => tx.type === 'win_payout');
    const winEntryB = historyB.find((tx) => tx.type === 'win_payout');

    expect(winEntryA).toBeDefined();
    expect(winEntryA?.amount).toBe(payout);
    expect(winEntryB).toBeUndefined();
  });
});
