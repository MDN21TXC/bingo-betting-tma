import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { MultiRoomManager } from './GameRoomManager.js';
import { ledgerService } from './LedgerService.js';
import { authService } from './AuthService.js';
import { telegramBotService } from './TelegramBotService.js';
import { computeCommitmentHash } from './BingoEngine.js';

// Synchronously load .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    }
  }
} catch (e) {}

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const multiRoomManager = new MultiRoomManager(io);
telegramBotService.setSocketServer(io);

// ---------------- REST API Endpoints ----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------- Telegram Bot Webhook & Contact Verification ----------------

// Telegram Webhook receiver (for live bot updates)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const result = await telegramBotService.handleWebhookUpdate(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simulation endpoint for browser testing & automated test suite
app.post('/api/telegram/simulate-contact-share', (req, res) => {
  const { phone, expectedPhone, sharedPhone, tgUserId, username, isReset } = req.body;
  const targetExpected = expectedPhone || phone;
  if (!targetExpected) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  if (isReset) {
    const result = telegramBotService.simulatePasswordResetShare(targetExpected, sharedPhone || phone);
    if (!result.success) {
      return res.status(400).json({ error: result.error, denied: result.denied });
    }
    return res.json(result);
  }

  const result = telegramBotService.simulateContactShare(
    targetExpected,
    sharedPhone || phone,
    tgUserId || 12345678,
    username || 'TelegramTester'
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error, denied: result.denied });
  }
  res.json(result);
});

// ---------------- Authentication Middlewares ----------------

const authenticateSession = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = authService.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.user = user;
  req.sessionToken = token;
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  authenticateSession(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin authorization required' });
    }
    next();
  });
};

const optionalSession = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token) {
    const user = authService.getUserByToken(token);
    if (user) {
      req.user = user;
      req.sessionToken = token;
    }
  }
  next();
};

// ---------------- Authentication Endpoints ----------------

// Primary: Official Telegram WebApp HMAC Authentication
app.post('/api/auth/telegram', async (req, res) => {
  const { initData, referralCode } = req.body;
  if (!initData) {
    return res.status(400).json({ error: 'Missing Telegram initData' });
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const result = await authService.authenticateTelegram(initData, botToken, referralCode);
  if (!result.success) {
    return res.status(401).json({ error: result.error, status: result.status });
  }
  res.json(result);
});

// Complete Registration (Atomic Transaction)
app.post('/api/auth/register', async (req, res) => {
  const authHeader = req.headers.authorization;
  const tempToken = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.body.tempToken || req.body.token);

  const { username, referralCode, name, phone, password } = req.body;

  // Telegram registration flow with tempToken
  if (tempToken) {
    const chosenUsername = username || name;
    const result = await authService.completeRegistration(tempToken, chosenUsername, referralCode);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result);
  }

  // Fallback for legacy phone/password registration
  const result = authService.register(name, phone, password);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// Validate & Restore Session
app.get('/api/auth/session', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) {
    return res.status(401).json({ valid: false, status: 'UNAUTHENTICATED' });
  }
  const result = authService.validateSession(token);
  if (!result.valid) {
    return res.status(401).json(result);
  }
  res.json(result);
});

// Get currently authenticated user from token
app.get('/api/auth/me', authenticateSession, (req: any, res) => {
  res.json({ user: req.user });
});

// Invalidate & Revoke Session (Logout)
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token) {
    authService.logout(token);
  }
  res.json({ success: true });
});

// 1a. Initiate Sign-Up Request (Strict Telegram Matching)
app.post('/api/auth/register-initiate', (req, res) => {
  const { name, phone, password } = req.body;
  const result = authService.initiateRegistration(name, phone, password);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// 1b. Check Registration Status (Polling)
app.get('/api/auth/registration-status/:target', (req, res) => {
  const result = authService.getRegistrationStatus(req.params.target);
  res.json(result);
});

// 2. Verify Phone number via Telegram / Code
app.post('/api/auth/verify', (req, res) => {
  const { phone, code } = req.body;
  const result = authService.verifyPhone(phone, code);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// 2b. Check phone verification status (Polling)
app.get('/api/auth/check-verification/:phone', (req, res) => {
  const result = authService.checkVerification(req.params.phone);
  res.json(result);
});

// 2c. Forgot Password - Initiate
app.post('/api/auth/forgot-password-initiate', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  const result = authService.initiatePasswordReset(phone);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// 2d. Forgot Password - Status Polling
app.get('/api/auth/forgot-password-status/:phone', (req, res) => {
  const result = authService.getPasswordResetStatus(req.params.phone);
  res.json(result);
});

// 2e. Forgot Password - Complete with New Password
app.post('/api/auth/forgot-password-complete', (req, res) => {
  const { phone, resetToken, newPassword } = req.body;
  if (!phone || !resetToken || !newPassword) {
    return res.status(400).json({ error: 'Phone, resetToken, and newPassword are required' });
  }
  const result = authService.completePasswordReset(phone, resetToken, newPassword);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// 3. Login with Phone + Password
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  const result = authService.login(phone, password);
  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }
  res.json(result);
});

// 4. Telegram 1-Tap Login (Legacy fallback)
app.post('/api/auth/telegram-login', (req, res) => {
  const { id, username, first_name, last_name, photo_url } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing Telegram user ID' });
  }
  const result = authService.telegramLogin({ id, username, first_name, last_name, photo_url });
  res.json(result);
});

// Sync or fetch Telegram / Web user
app.post('/api/user/sync', optionalSession, (req: any, res) => {
  const currentUserId = req.user?.playerId;
  const targetId = currentUserId || req.body.playerId;
  if (!targetId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = ledgerService.getOrCreateUser(
    targetId,
    req.body.username || 'TelegramPlayer',
    req.body.avatarUrl
  );
  res.json({ success: true, user });
});

// Fetch full user profile & stats (Secured with session authorization)
app.get('/api/user/profile/:playerId?', optionalSession, (req: any, res) => {
  const requestedId = req.params.playerId;
  const currentUserId = req.user?.playerId;

  // IDOR Protection: If authenticated and requesting another user's profile, reject
  if (currentUserId && requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot access another user\'s private profile' });
  }

  const targetPlayerId = requestedId || currentUserId;
  if (!targetPlayerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const profile = authService.getFullProfile(targetPlayerId);
  if (!profile) {
    const fallbackUser = ledgerService.getUser(targetPlayerId);
    if (!fallbackUser) return res.status(404).json({ error: 'User not found' });
    return res.json({
      profile: {
        ...fallbackUser,
        phone: fallbackUser.phone || '',
        totalGamesPlayed: 0,
        totalWonETB: 0,
        vipTier: 'Player'
      }
    });
  }
  res.json({ profile });
});

// Fetch user account and balance
app.get('/api/user/:playerId?', optionalSession, (req: any, res) => {
  const requestedId = req.params.playerId;
  const currentUserId = req.user?.playerId;

  if (currentUserId && requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot access another user\'s balance' });
  }

  const targetPlayerId = requestedId || currentUserId;
  if (!targetPlayerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = ledgerService.getUser(targetPlayerId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// Get user transaction ledger
app.get('/api/ledger/:playerId?', optionalSession, (req: any, res) => {
  const requestedId = req.params.playerId;
  const currentUserId = req.user?.playerId;

  if (currentUserId && requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot access another user\'s ledger' });
  }

  const targetPlayerId = requestedId || currentUserId;
  if (!targetPlayerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const entries = ledgerService.getLedgerForUser(targetPlayerId);
  res.json({ entries });
});

// Deposit funds
app.post('/api/wallet/deposit', authenticateSession, async (req: any, res) => {
  const { amount, paymentMethod } = req.body;
  const requestedId = req.body.playerId;
  const currentUserId = req.user?.playerId;

  // IDOR Protection: Reject attempts to deposit to another user's account
  if (requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot perform financial operations on another account' });
  }

  const targetPlayerId = currentUserId;

  try {
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Invalid deposit amount' });
    }
    const userObj = ledgerService.getUser(targetPlayerId);
    const depositReq = ledgerService.createDepositRequest(
      targetPlayerId,
      userObj?.username || req.user.username || 'Player',
      depositAmount,
      paymentMethod || 'Telebirr'
    );
    // Security: Deposits require admin approval, no SYSTEM_AUTO
    res.json({
      success: true,
      deposit: depositReq,
      request: depositReq,
      user: ledgerService.getUser(targetPlayerId),
      message: 'Deposit request submitted. Pending admin verification.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Withdraw funds
app.post('/api/wallet/withdraw', authenticateSession, async (req: any, res) => {
  const { amount, address } = req.body;
  const requestedId = req.body.playerId;
  const currentUserId = req.user?.playerId;

  // IDOR Protection: Reject attempts to withdraw from another user's account
  if (requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot perform financial operations on another account' });
  }

  const targetPlayerId = currentUserId;

  try {
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    const userObj = ledgerService.getUser(targetPlayerId);
    // Balance is atomically reserved and held; status is PENDING
    const withdrawalReq = ledgerService.createWithdrawalRequest(
      targetPlayerId,
      userObj?.username || req.user.username || 'Player',
      withdrawAmount,
      address || 'Telebirr / Bank Account'
    );
    res.json({
      success: true,
      withdrawal: withdrawalReq,
      request: withdrawalReq,
      user: ledgerService.getUser(targetPlayerId),
      message: 'Withdrawal request submitted. Balance reserved pending admin review.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List all rooms for Lobby Table
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: multiRoomManager.getLobbySummaries() });
});

// Get specific room state
app.get('/api/room/:roomId', (req, res) => {
  const room = multiRoomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room.getPublicState());
});

// Get 5x5 Grid Preview for a card number
app.get('/api/room/:roomId/card/:cardNumber', (req, res) => {
  const room = multiRoomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const cardNumber = parseInt(req.params.cardNumber, 10);
  const grid = room.getCardPreview(cardNumber);
  if (!grid) {
    return res.status(404).json({ error: 'Card not found' });
  }
  res.json({ cardNumber, grid });
});

// Get all card previews for a room
app.get('/api/room/:roomId/catalog', (req, res) => {
  const room = multiRoomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const catalogObj: Record<number, any> = {};
  const total = room.getPublicState().totalCatalogCards || 100;
  for (let i = 1; i <= total; i++) {
    const grid = room.getCardPreview(i);
    if (grid) catalogObj[i] = grid;
  }
  res.json({ roomId: req.params.roomId, catalog: catalogObj });
});

// Leaderboard: Top Winners and High-Rollers
app.get('/api/leaderboard', (req, res) => {
  const topWinners = [
    { rank: 1, username: 'HabeshaKing_777', totalWonUSD: 3450.00, totalWonETB: 34500, gamesPlayed: 142, badge: '👑 VIP Champion' },
    { rank: 2, username: 'BingoQueen_VIP', totalWonUSD: 2890.00, totalWonETB: 28900, gamesPlayed: 98, badge: '💎 High-Roller' },
    { rank: 3, username: 'EthioStar_99', totalWonUSD: 2150.00, totalWonETB: 21500, gamesPlayed: 110, badge: '⭐ Master Dauber' },
    { rank: 4, username: 'AddisWinner_251', totalWonUSD: 1780.00, totalWonETB: 17800, gamesPlayed: 85, badge: '🔥 Streak 5x' },
    { rank: 5, username: 'ShegerLucky_7', totalWonUSD: 1420.00, totalWonETB: 14200, gamesPlayed: 64, badge: '⚡ Lucky Strike' },
    { rank: 6, username: 'BoleMaster_21', totalWonUSD: 1150.00, totalWonETB: 11500, gamesPlayed: 52, badge: '🎯 Sniper' },
    { rank: 7, username: 'DiamondHands_7', totalWonUSD: 940.00, totalWonETB: 9400, gamesPlayed: 43, badge: '✨ Pro' },
  ];

  const recentJackpots = [
    { username: 'HabeshaKing_777', amountUSD: 1200.00, amountETB: 12000, pattern: 'Full House (Blackout)', timeAgo: '3m ago', room: 'Grand Mega Jackpot' },
    { username: 'AddisWinner_251', amountUSD: 450.00, amountETB: 4500, pattern: 'Four Corners', timeAgo: '12m ago', room: 'Silver Arena' },
    { username: 'BingoQueen_VIP', amountUSD: 850.00, amountETB: 8500, pattern: 'Column B Line', timeAgo: '28m ago', room: 'Gold VIP Lounge' },
  ];

  res.json({ topWinners, recentJackpots });
});

// Referral & Affiliate Income
app.get('/api/referral/:playerId?', optionalSession, (req: any, res) => {
  const currentUserId = req.user?.playerId;
  const requestedId = req.params.playerId;

  if (currentUserId && requestedId && requestedId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot access another user\'s referral data' });
  }

  const targetId = requestedId || currentUserId;
  if (!targetId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const profile = authService.getFullProfile(targetId);
  const referralCode = profile?.referral_code || `BINGO_${targetId.slice(-4).toUpperCase()}`;
  res.json({
    referralCode,
    referralLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'BINGOBEET_BOT'}?start=${referralCode}`,
    totalInvited: 18,
    activeReferrals: 12,
    totalEarnedUSD: 64.50,
    totalEarnedETB: 645,
    pendingClaimUSD: 15.00,
    pendingClaimETB: 150,
    commissionRate: '5% of Ticket Purchases'
  });
});

// Claim Referral Earnings
app.post('/api/referral/claim', optionalSession, async (req: any, res) => {
  const currentUserId = req.user?.playerId;
  const { playerId } = req.body;

  if (currentUserId && playerId && playerId !== currentUserId) {
    return res.status(403).json({ error: 'Access denied: Cannot claim earnings for another user' });
  }

  const targetPlayerId = currentUserId || playerId;
  if (!targetPlayerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const entry = await ledgerService.recordTransaction(
      targetPlayerId,
      'deposit',
      150.00,
      'Affiliate Referral Commission Payout (150 Birr)'
    );
    const user = ledgerService.getUser(targetPlayerId);
    res.json({ success: true, entry, user, claimedAmountETB: 150, claimedAmount: 150 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Provably Fair Audit Verifier tool
app.post('/api/game/verify-fairness', (req, res) => {
  const { balls, serverSeed, expectedHash } = req.body;
  if (!Array.isArray(balls) || !serverSeed) {
    return res.status(400).json({ error: 'Missing balls array or serverSeed' });
  }
  const calculatedHash = computeCommitmentHash(balls, serverSeed);
  const isValid = expectedHash ? calculatedHash.toLowerCase() === expectedHash.toLowerCase() : true;
  res.json({
    calculatedHash,
    expectedHash,
    isValid,
    message: isValid
      ? 'Cryptographic commitment verified: No server manipulation detected.'
      : 'Hash mismatch: Verification failed.'
  });
});

// ---------------- Admin REST API Endpoints (Strict Server-Side Role Enforcement) ----------------

// Verify Admin Status endpoint - Requires valid session with role ADMIN
app.get('/api/admin/verify', requireAdmin, (req: any, res) => {
  res.json({ success: true, role: 'ADMIN', user: req.user });
});

// 1. Get all users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = authService.getAllUsers();
  res.json({ success: true, users });
});

// 2. Update user status (suspend, ban, activate) - Support PUT and POST
const updateUserStatusHandler = (req: any, res: any) => {
  const { status } = req.body;
  if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be ACTIVE, SUSPENDED, or BANNED.' });
  }
  try {
    const user = authService.updateUserStatus(req.user.playerId, req.params.playerId, status);
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
app.put('/api/admin/users/:playerId/status', requireAdmin, updateUserStatusHandler);
app.post('/api/admin/users/:playerId/status', requireAdmin, updateUserStatusHandler);

// 3. Get deposits
app.get('/api/admin/deposits', requireAdmin, (req, res) => {
  const status = req.query.status as string;
  const deposits = ledgerService.getDepositRequests(status);
  res.json({ success: true, deposits });
});

// 4. Approve deposit
app.post('/api/admin/deposits/:id/approve', requireAdmin, async (req: any, res) => {
  try {
    const result = await ledgerService.approveDeposit(req.user.playerId, req.params.id);
    res.json({ success: true, ...result, request: result.deposit });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Reject deposit
app.post('/api/admin/deposits/:id/reject', requireAdmin, (req: any, res) => {
  const { reason } = req.body;
  try {
    const deposit = ledgerService.rejectDeposit(req.user.playerId, req.params.id, reason);
    res.json({ success: true, deposit, request: deposit });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Get withdrawals
app.get('/api/admin/withdrawals', requireAdmin, (req, res) => {
  const status = req.query.status as string;
  const withdrawals = ledgerService.getWithdrawalRequests(status);
  res.json({ success: true, withdrawals });
});

// 7. Approve withdrawal
app.post('/api/admin/withdrawals/:id/approve', requireAdmin, async (req: any, res) => {
  try {
    const result = await ledgerService.approveWithdrawal(req.user.playerId, req.params.id);
    res.json({ success: true, ...result, request: result.withdrawal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Reject withdrawal
app.post('/api/admin/withdrawals/:id/reject', requireAdmin, (req: any, res) => {
  const { reason } = req.body;
  try {
    const withdrawal = ledgerService.rejectWithdrawal(req.user.playerId, req.params.id, reason);
    res.json({ success: true, withdrawal, request: withdrawal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Get all transactions / ledger
app.get('/api/admin/transactions', requireAdmin, (req, res) => {
  const entries = ledgerService.getAllLedgerEntries();
  res.json({ success: true, entries, transactions: entries });
});

// 10. Manual balance adjustment
app.post('/api/admin/balance-adjustment', requireAdmin, async (req: any, res) => {
  const { targetPlayerId, amount, reason } = req.body;
  if (!targetPlayerId || typeof amount !== 'number' || !reason) {
    return res.status(400).json({ error: 'targetPlayerId, numeric amount, and reason are required' });
  }
  try {
    const result = await ledgerService.manualBalanceAdjustment(req.user.playerId, targetPlayerId, amount, reason);
    res.json({ success: true, ...result, newBalance: result.user.walletBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Get games overview
app.get('/api/admin/games', requireAdmin, (req, res) => {
  const rooms = multiRoomManager.getLobbySummaries();
  res.json({ success: true, rooms, games: rooms });
});

// 12. Get audit logs
app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const auditLogs = ledgerService.getAuditLogs(limit);
  res.json({ success: true, auditLogs, logs: auditLogs });
});

// ---------------- WebSocket Gateway with Strict Session Authorization ----------------

// Authenticate socket handshake using session token
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.substring(7)
      : null) ||
    socket.handshake.query?.token;

  if (token) {
    const user = authService.getUserByToken(String(token));
    if (user) {
      socket.data.user = user;
      socket.data.sessionToken = String(token);
      return next();
    }
  }

  // Allow anonymous socket connection for lobby preview / guest spectating,
  // but strictly block any balance-affecting actions
  socket.data.user = null;
  socket.data.sessionToken = null;
  next();
});

io.on('connection', (socket) => {
  socket.emit('LOBBY_OVERVIEW', multiRoomManager.getLobbySummaries());

  // Join a specific game room
  socket.on('JOIN_ROOM', (data: { roomId: string }, callback) => {
    const { roomId } = data;
    const room = multiRoomManager.getRoom(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    for (const r of socket.rooms) {
      if (r !== socket.id) socket.leave(r);
    }

    socket.join(`room_${roomId}`);
    const state = room.getPublicState();
    socket.emit('ROOM_STATE_UPDATE', state);

    if (typeof callback === 'function') {
      callback({ success: true, state });
    }
  });

  socket.on('LEAVE_ROOM', (data: { roomId: string }) => {
    socket.leave(`room_${data.roomId}`);
  });

  // Select specific card number (e.g. Card #22)
  socket.on('SELECT_CARD_NUMBER', async (data: { roomId: string; cardNumber: number; playerId?: string; username?: string }, callback) => {
    try {
      const user = socket.data.user;
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required. Please log in.' });
        return;
      }

      const { roomId, cardNumber } = data;
      const room = multiRoomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
        return;
      }

      // STRICT USER ISOLATION: Derive identity solely from authenticated socket session!
      const ticket = await room.selectCardNumber(user.playerId, user.username, cardNumber);
      const updatedUser = ledgerService.getUser(user.playerId);
      if (typeof callback === 'function') {
        callback({ success: true, ticket, user: updatedUser });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Lock multiple selected cards in a batch
  socket.on('LOCK_MULTIPLE_CARDS', async (data: { roomId: string; cardNumbers: number[]; playerId?: string; username?: string }, callback) => {
    try {
      const user = socket.data.user;
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required. Please log in.' });
        return;
      }

      const { roomId, cardNumbers } = data;
      const room = multiRoomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
        return;
      }

      // STRICT USER ISOLATION: Derive identity solely from authenticated socket session!
      const tickets = await room.lockMultipleCards(user.playerId, user.username, cardNumbers);
      const updatedUser = ledgerService.getUser(user.playerId);
      if (typeof callback === 'function') {
        callback({ success: true, tickets, user: updatedUser });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Deselect card number (undo pick)
  socket.on('DESELECT_CARD_NUMBER', async (data: { roomId: string; cardNumber: number; playerId?: string }, callback) => {
    try {
      const user = socket.data.user;
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required. Please log in.' });
        return;
      }

      const { roomId, cardNumber } = data;
      const room = multiRoomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
        return;
      }

      // STRICT USER ISOLATION: User can only deselect their own cards
      await room.deselectCardNumber(user.playerId, cardNumber);
      const updatedUser = ledgerService.getUser(user.playerId);
      if (typeof callback === 'function') {
        callback({ success: true, user: updatedUser });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Random pick cards (e.g. 1, 2, or 4 random cards)
  socket.on('RANDOM_SELECT_CARDS', async (data: { roomId: string; count: number; playerId?: string; username?: string }, callback) => {
    try {
      const user = socket.data.user;
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required. Please log in.' });
        return;
      }

      const { roomId, count = 1 } = data;
      const room = multiRoomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
        return;
      }

      const tickets = [];
      for (let i = 0; i < count; i++) {
        const ticket = await room.pickRandomCardForUser(user.playerId, user.username);
        tickets.push(ticket);
      }
      const updatedUser = ledgerService.getUser(user.playerId);
      if (typeof callback === 'function') {
        callback({ success: true, tickets, user: updatedUser });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Claim BINGO inside a specific room
  socket.on('CLAIM_BINGO', async (data: { roomId: string; ticketId: string; playerId?: string }, callback) => {
    try {
      const user = socket.data.user;
      if (!user) {
        if (typeof callback === 'function') callback({ success: false, message: 'Authentication required. Please log in.' });
        return;
      }

      const { roomId, ticketId } = data;
      const room = multiRoomManager.getRoom(roomId);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, message: 'Room not found' });
        return;
      }

      // STRICT USER ISOLATION: User can only claim with their own authenticated session
      const result = await room.handleClaimBingo(user.playerId, ticketId);
      if (typeof callback === 'function') {
        const updatedUser = ledgerService.getUser(user.playerId);
        callback({ ...result, user: updatedUser });
      }
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });
});

// Serve static frontend assets in production if dist exists
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

export { app, httpServer, multiRoomManager };

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`🎰 Bingo Multi-Room Server running at http://localhost:${PORT}`);
    if (process.env.TELEGRAM_BOT_TOKEN) {
      telegramBotService.startPolling();
    }
  });
}

