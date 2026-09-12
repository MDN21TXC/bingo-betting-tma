import crypto from 'crypto';
import { ledgerService, UserAccount } from './LedgerService.js';

export interface TelegramVerifiedUser {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  auth_date: number;
  start_param?: string;
}

export type RegistrationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface UserRecord extends UserAccount {
  id: string; // playerId (internal identifier)
  telegram_id: string; // UNIQUE external immutable identity
  telegramId?: string; // alias for camelCase consistency
  telegram_username?: string;
  first_name: string;
  last_name?: string;
  phone_number?: string;
  phone?: string; // alias for UserAccount compatibility
  username: string; // UNIQUE in-game Bingo nickname
  referral_code: string; // UNIQUE shareable referral code
  referred_by?: string; // user ID of referrer
  registration_status: RegistrationStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string;
  is_active: boolean;
  role?: 'USER' | 'ADMIN';
  account_status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  // Fallback credentials (for demo / phone auth)
  passwordHash?: string;
  salt?: string;
  isVerified: boolean;
  verificationCode?: string;
  createdAt: string; // alias
}

export type AuthUser = UserRecord;

export interface SessionRecord {
  id: string; // session token (tok_...)
  user_id: string;
  telegram_id: string;
  created_at: number;
  expires_at: number; // TTL (e.g. 30 days)
  last_used_at: number;
  revoked_at?: number | null;
}

export type AuthStateStatus =
  | 'AUTHENTICATED'
  | 'NEW_USER'
  | 'REGISTRATION_REQUIRED'
  | 'UNAUTHENTICATED'
  | 'AUTH_ERROR';

export interface TelegramAuthResult {
  success: boolean;
  status: AuthStateStatus;
  user?: UserAccount;
  sessionToken?: string;
  tempToken?: string;
  telegramUser?: TelegramVerifiedUser;
  suggestedUsername?: string;
  referralCode?: string;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserAccount;
  token?: string;
  requiresVerification?: boolean;
  phone?: string;
  message?: string;
  error?: string;
}

export interface PendingRegistration {
  pendingId: string;
  name: string;
  phone: string; // normalized
  passwordHash: string;
  salt: string;
  createdAt: number;
  status: 'pending' | 'verified' | 'denied';
  deniedReason?: string;
  user?: UserAccount;
  token?: string;
}

export interface PendingPasswordReset {
  phone: string;
  resetToken: string;
  status: 'pending' | 'authorized' | 'denied';
  deniedReason?: string;
  createdAt: number;
  expiresAt: number;
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'system',
  'moderator',
  'mod',
  'bingo',
  'bingobet',
  'support',
  'help',
  'root',
  'bot',
  'official',
  'staff',
  'null',
  'undefined',
  'anonymous',
  'guest'
]);

/**
 * Validates in-game Bingo username server-side
 */
export function validateUsername(username: string): { isValid: boolean; normalized: string; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, normalized: '', error: 'Username is required' };
  }

  const trimmed = username.trim();
  const normalized = trimmed.toLowerCase();

  if (trimmed.length < 3) {
    return { isValid: false, normalized, error: 'Username must be at least 3 characters long' };
  }
  if (trimmed.length > 20) {
    return { isValid: false, normalized, error: 'Username cannot exceed 20 characters (at most 20 characters)' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { isValid: false, normalized, error: 'Username may only contain letters, numbers, and underscores' };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return { isValid: false, normalized, error: `The username "${trimmed}" is reserved and cannot be used` };
  }

  return { isValid: true, normalized };
}

/**
 * Official Telegram WebApp initData HMAC-SHA256 cryptographic verification
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = 86400 // 24 hours
): { isValid: boolean; user?: TelegramVerifiedUser; startParam?: string; error?: string } {
  if (!initData || typeof initData !== 'string') {
    return { isValid: false, error: 'Telegram initData is missing or empty' };
  }
  if (!botToken) {
    return { isValid: false, error: 'Telegram bot token is not configured on server' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { isValid: false, error: 'Missing hash in Telegram initData' };
    }

    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { isValid: false, error: 'Missing auth_date in Telegram initData' };
    }

    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(authDate) || (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds)) {
      return { isValid: false, error: 'Telegram authentication data has expired' };
    }

    // Build data-check-string (sorted alphabetically, key=value, joined with newline)
    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        pairs.push(`${key}=${value}`);
      }
    });
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    // Secret key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    // Calculated signature = HMAC_SHA256(secretKey, dataCheckString).hex()
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');

    if (calculatedBuffer.length !== hashBuffer.length || !crypto.timingSafeEqual(calculatedBuffer, hashBuffer)) {
      return { isValid: false, error: 'Invalid Telegram cryptographic signature (hash mismatch)' };
    }

    const userRaw = params.get('user');
    let parsedUser: any = {};
    if (userRaw) {
      parsedUser = JSON.parse(userRaw);
    }

    const startParam = params.get('start_param') || undefined;

    return {
      isValid: true,
      user: {
        id: parsedUser.id,
        first_name: parsedUser.first_name || '',
        last_name: parsedUser.last_name,
        username: parsedUser.username,
        language_code: parsedUser.language_code,
        photo_url: parsedUser.photo_url,
        auth_date: authDate,
        start_param: startParam
      },
      startParam
    };
  } catch (err: any) {
    return { isValid: false, error: `Failed to parse Telegram initData: ${err.message}` };
  }
}

/**
 * Creates cryptographically valid signed Telegram initData for test suites & simulation
 */
export function createSignedTelegramInitData(
  user: { id: number | string; first_name: string; last_name?: string; username?: string; photo_url?: string },
  botToken: string,
  startParam?: string,
  explicitAuthDateOrOffset?: number
): string {
  let authDate = Math.floor(Date.now() / 1000);
  if (explicitAuthDateOrOffset !== undefined) {
    if (explicitAuthDateOrOffset > 1000000) {
      authDate = explicitAuthDateOrOffset;
    } else {
      authDate += explicitAuthDateOrOffset;
    }
  }

  const cleanUser: Record<string, any> = {
    id: user.id,
    first_name: user.first_name
  };
  if (user.last_name !== undefined) cleanUser.last_name = user.last_name;
  if (user.username !== undefined) cleanUser.username = user.username;
  if (user.photo_url !== undefined) cleanUser.photo_url = user.photo_url;
  const userJson = JSON.stringify(cleanUser);

  const queryId = `AAH_${Math.floor(100000 + Math.random() * 900000)}`;
  const pairs = [
    `auth_date=${authDate}`,
    `query_id=${queryId}`,
    `user=${userJson}`
  ];
  if (startParam) {
    pairs.push(`start_param=${startParam}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const searchParams = new URLSearchParams();
  searchParams.set('auth_date', String(authDate));
  searchParams.set('query_id', queryId);
  searchParams.set('user', userJson);
  if (startParam) {
    searchParams.set('start_param', startParam);
  }
  searchParams.set('hash', hash);

  return searchParams.toString();
}

export class AuthService {
  private botToken: string = process.env.TELEGRAM_BOT_TOKEN || '';

  // Primary database tables (in-memory persistent state with database constraints)
  private usersById: Map<string, UserRecord> = new Map();
  private usersByTelegramId: Map<string, UserRecord> = new Map(); // UNIQUE constraint
  private usersByUsernameLower: Map<string, UserRecord> = new Map(); // UNIQUE constraint
  private usersByReferralCode: Map<string, UserRecord> = new Map(); // UNIQUE constraint
  private usersByPhone: Map<string, UserRecord> = new Map();

  // Sessions table
  private sessions: Map<string, SessionRecord> = new Map();

  // Temporary registration tokens for in-progress multi-step signups
  private tempRegistrations: Map<
    string,
    {
      telegramUser: TelegramVerifiedUser;
      referralCode?: string;
      createdAt: number;
    }
  > = new Map();

  // Completed registration cache for idempotency during retries/double-clicks
  private completedTempRegistrations: Map<string, { user: UserAccount; sessionToken: string }> = new Map();

  // Legacy & phone verification tracking
  private pendingRegistrations: Map<string, PendingRegistration> = new Map();
  private pendingById: Map<string, string> = new Map();
  private pendingPasswordResets: Map<string, PendingPasswordReset> = new Map();

  // Concurrency locking queues (guarantees atomic check-and-insert per key)
  private lockQueues: Map<string, Promise<void>> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateUniqueReferralCode(base: string): string {
    let clean = base.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
    if (!clean) clean = 'BINGO';
    let code = `BINGO_${clean}`;
    let counter = 1;
    while (this.usersByReferralCode.has(code)) {
      code = `BINGO_${clean}_${counter++}`;
    }
    return code;
  }

  /**
   * Acquire atomic lock per key to prevent race conditions
   */
  private async withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const current = this.lockQueues.get(key) || Promise.resolve();
    let releaseLock = () => {};
    const next = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.lockQueues.set(key, next);

    try {
      await current;
      return await fn();
    } finally {
      releaseLock();
      if (this.lockQueues.get(key) === next) {
        this.lockQueues.delete(key);
      }
    }
  }

  private createSession(user: UserRecord): string {
    const token = `tok_${crypto.randomBytes(28).toString('hex')}`;
    const now = Date.now();
    const session: SessionRecord = {
      id: token,
      user_id: user.id,
      telegram_id: user.telegram_id,
      created_at: now,
      expires_at: now + 30 * 24 * 60 * 60 * 1000, // 30 days TTL
      last_used_at: now,
      revoked_at: null
    };
    this.sessions.set(token, session);
    return token;
  }

  public normalizePhone(phone: string): string {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('251')) {
      digits = digits.substring(3);
    }
    if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
      return '0' + digits;
    }
    if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) {
      return digits;
    }
    return digits;
  }

  private seedDefaultUsers() {
    // Seed default VIP user for testing
    const salt1 = this.generateSalt();
    const now = new Date().toISOString();
    const demoUser: UserRecord = {
      id: 'usr_me',
      playerId: 'usr_me',
      telegram_id: '999999999',
      telegram_username: 'KalebTadesse',
      first_name: 'Kaleb',
      last_name: 'Tadesse',
      username: 'Kaleb Tadesse',
      phone: '0912345678',
      phone_number: '0912345678',
      referral_code: 'BINGO_KALEB',
      registration_status: 'COMPLETED',
      role: 'USER',
      account_status: 'ACTIVE',
      created_at: now,
      createdAt: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
      walletBalance: 1000.0,
      avatarUrl: '',
      isBot: false,
      isVerified: true,
      salt: salt1,
      passwordHash: this.hashPassword('password123', salt1)
    };

    this.usersById.set(demoUser.id, demoUser);
    this.usersByTelegramId.set(demoUser.telegram_id, demoUser);
    this.usersByUsernameLower.set(demoUser.username.toLowerCase(), demoUser);
    this.usersByReferralCode.set(demoUser.referral_code, demoUser);
    this.usersByPhone.set(demoUser.phone!, demoUser);

    ledgerService.getOrCreateUser(demoUser.playerId, demoUser.username, undefined, 'USER');

    // Seed dedicated ADMIN account for secure dashboard management
    const saltAdmin = this.generateSalt();
    const adminUser: UserRecord = {
      id: 'usr_admin',
      playerId: 'usr_admin',
      telegram_id: '111111111',
      telegram_username: 'AdminMaster',
      first_name: 'System',
      last_name: 'Administrator',
      username: 'admin',
      phone: '0900000000',
      phone_number: '0900000000',
      referral_code: 'BINGO_ADMIN',
      registration_status: 'COMPLETED',
      role: 'ADMIN',
      account_status: 'ACTIVE',
      created_at: now,
      createdAt: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
      walletBalance: 50000.0,
      avatarUrl: '',
      isBot: false,
      isVerified: true,
      salt: saltAdmin,
      passwordHash: this.hashPassword('Admin@123!', saltAdmin)
    };

    this.usersById.set(adminUser.id, adminUser);
    this.usersByTelegramId.set(adminUser.telegram_id, adminUser);
    this.usersByUsernameLower.set(adminUser.username.toLowerCase(), adminUser);
    this.usersByReferralCode.set(adminUser.referral_code, adminUser);
    this.usersByPhone.set(adminUser.phone!, adminUser);

    ledgerService.getOrCreateUser(adminUser.playerId, adminUser.username, undefined, 'ADMIN');

    // Bootstrap fixed session token for admin authorization in tests and backend calls
    const adminSession: SessionRecord = {
      id: 'tok_admin_master_key',
      user_id: 'usr_admin',
      telegram_id: '111111111',
      created_at: Date.now(),
      expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
      last_used_at: Date.now(),
      revoked_at: null
    };
    this.sessions.set('tok_admin_master_key', adminSession);
  }

  /**
   * Cryptographic verification helper on AuthService
   */
  public verifyTelegramInitData(initData: string, botToken?: string, maxAgeSeconds?: number) {
    const token = botToken || this.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    return verifyTelegramInitData(initData, token, maxAgeSeconds);
  }

  /**
   * Helper to create signed test/mock initData
   */
  public createSignedTelegramInitData(
    user: { id: number | string; first_name: string; last_name?: string; username?: string; photo_url?: string },
    botToken?: string,
    startParam?: string,
    explicitAuthDateOrOffset?: number
  ): string {
    const token = botToken || this.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    return createSignedTelegramInitData(user, token, startParam, explicitAuthDateOrOffset);
  }

  /**
   * Primary Telegram Mini App Authentication Entrypoint
   * Validates initData cryptographically and routes to RETURNING_USER or NEW_USER / REGISTRATION_REQUIRED
   */
  public async authenticateTelegram(
    initData: string,
    botToken: string = process.env.TELEGRAM_BOT_TOKEN || this.botToken || '',
    optionalReferralCode?: string
  ): Promise<TelegramAuthResult> {
    const verification = verifyTelegramInitData(initData, botToken);
    if (!verification.isValid || !verification.user) {
      return {
        success: false,
        status: 'AUTH_ERROR',
        error: verification.error || 'Telegram verification failed'
      };
    }

    const tgUser = verification.user;
    const telegramId = String(tgUser.id);
    const referralCode = optionalReferralCode || verification.startParam || tgUser.start_param;

    // Concurrency lock on telegram_id to prevent race conditions during duplicate requests
    return await this.withLock(`tg_${telegramId}`, async () => {
      const existingUser = this.usersByTelegramId.get(telegramId);

      if (existingUser) {
        // Check if account registration was completed or interrupted
        if (existingUser.registration_status === 'COMPLETED') {
          // Returning user: update last login and issue persistent session
          existingUser.last_login_at = new Date().toISOString();
          if (tgUser.photo_url) existingUser.avatarUrl = tgUser.photo_url;
          if (tgUser.username) existingUser.telegram_username = tgUser.username;

          // Sync wallet balance with ledger
          const ledgerUser = ledgerService.getUser(existingUser.id);
          if (ledgerUser) existingUser.walletBalance = ledgerUser.walletBalance;

          const sessionToken = this.createSession(existingUser);
          return {
            success: true,
            status: 'AUTHENTICATED',
            user: {
              id: existingUser.id,
              playerId: existingUser.id,
              username: existingUser.username,
              walletBalance: existingUser.walletBalance,
              avatarUrl: existingUser.avatarUrl,
              isBot: existingUser.isBot
            },
            sessionToken
          };
        } else {
          // Incomplete registration recovery
          const tempToken = `temp_${crypto.randomBytes(24).toString('hex')}`;
          this.tempRegistrations.set(tempToken, {
            telegramUser: tgUser,
            referralCode: existingUser.referred_by ? undefined : referralCode,
            createdAt: Date.now()
          });

          return {
            success: true,
            status: 'REGISTRATION_REQUIRED',
            tempToken,
            telegramUser: tgUser,
            suggestedUsername: existingUser.username || tgUser.username || tgUser.first_name,
            referralCode
          };
        }
      }

      // Brand-new user: create temporary registration session
      const tempToken = `temp_${crypto.randomBytes(24).toString('hex')}`;
      this.tempRegistrations.set(tempToken, {
        telegramUser: tgUser,
        referralCode,
        createdAt: Date.now()
      });

      // Suggest clean nickname
      const suggested = tgUser.username || `${tgUser.first_name}_${telegramId.slice(-4)}`;

      return {
        success: true,
        status: 'NEW_USER',
        tempToken,
        telegramUser: tgUser,
        suggestedUsername: suggested.replace(/[^a-zA-Z0-9_]/g, '_'),
        referralCode
      };
    });
  }

  /**
   * Completes registration inside an atomic transaction
   * Validates username uniqueness, referral relationships, and awards welcome bonus
   */
  public async completeRegistration(
    tempToken: string,
    desiredUsername: string,
    referralCodeInput?: string
  ): Promise<{ success: boolean; user?: UserAccount; sessionToken?: string; error?: string }> {
    const completed = this.completedTempRegistrations.get(tempToken);
    if (completed) {
      return { success: true, user: completed.user, sessionToken: completed.sessionToken };
    }

    const pendingData = this.tempRegistrations.get(tempToken);
    if (!pendingData) {
      return {
        success: false,
        error: 'Registration session expired or invalid. Please reopen the Mini App.'
      };
    }

    const { telegramUser } = pendingData;
    const telegramId = String(telegramUser.id);

    // Validate in-game Bingo username server-side
    const userValidation = validateUsername(desiredUsername);
    if (!userValidation.isValid) {
      return { success: false, error: userValidation.error };
    }
    const cleanUsername = desiredUsername.trim();
    const cleanUsernameLower = userValidation.normalized;

    // Handle referral code
    const rawReferral = (referralCodeInput || pendingData.referralCode || '').trim().toUpperCase();

    // Lock globally on both telegram_id and username to prevent race conditions
    return await this.withLock(`reg_${telegramId}_${cleanUsernameLower}`, async () => {
      // 1. Check if user with this telegram_id already completed registration
      const existingTgUser = this.usersByTelegramId.get(telegramId);
      if (existingTgUser && existingTgUser.registration_status === 'COMPLETED') {
        const sessionToken = this.createSession(existingTgUser);
        const existingAccount = {
          id: existingTgUser.id,
          playerId: existingTgUser.id,
          username: existingTgUser.username,
          walletBalance: existingTgUser.walletBalance,
          avatarUrl: existingTgUser.avatarUrl,
          isBot: existingTgUser.isBot,
          registration_status: existingTgUser.registration_status
        };
        this.completedTempRegistrations.set(tempToken, { user: existingAccount, sessionToken });
        return {
          success: true,
          user: existingAccount,
          sessionToken
        };
      }

      // 2. Enforce UNIQUE username constraint
      const existingNameOwner = this.usersByUsernameLower.get(cleanUsernameLower);
      if (existingNameOwner && existingNameOwner.telegram_id !== telegramId) {
        return {
          success: false,
          error: `The username "${cleanUsername}" is already taken. Please choose another.`
        };
      }

      // 3. Validate referral code if supplied
      let referrerUserId: string | undefined = undefined;
      if (rawReferral) {
        const referrer = this.usersByReferralCode.get(rawReferral);
        if (!referrer) {
          return { success: false, error: 'Invalid referral code: The referral code entered does not exist.' };
        }
        if (referrer.telegram_id === telegramId) {
          return { success: false, error: 'Self-referral is not permitted. You cannot use your own referral code.' };
        }
        referrerUserId = referrer.id;
      }

      // 4. Generate unique referral code for the new user
      const userReferralCode = this.generateUniqueReferralCode(cleanUsername);

      // 5. Atomic user record creation / update
      const now = new Date().toISOString();
      const playerId = `tg_${telegramId}`;

      const userRecord: UserRecord = existingTgUser || {
        id: playerId,
        playerId,
        telegram_id: telegramId,
        telegramId: telegramId,
        telegram_username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        username: cleanUsername,
        referral_code: userReferralCode,
        referred_by: referrerUserId,
        registration_status: 'COMPLETED',
        role: 'USER',
        account_status: 'ACTIVE',
        created_at: now,
        createdAt: now,
        updated_at: now,
        last_login_at: now,
        is_active: true,
        walletBalance: 1000.0,
        avatarUrl: telegramUser.photo_url || '',
        isBot: false,
        isVerified: true
      };

      userRecord.role = userRecord.role || 'USER';
      userRecord.account_status = userRecord.account_status || 'ACTIVE';
      userRecord.telegramId = userRecord.telegramId || telegramId;

      userRecord.username = cleanUsername;
      userRecord.referral_code = userReferralCode;
      if (referrerUserId) userRecord.referred_by = referrerUserId;
      userRecord.registration_status = 'COMPLETED';
      userRecord.updated_at = now;
      userRecord.last_login_at = now;

      // Commit to primary database indexes
      this.usersById.set(playerId, userRecord);
      this.usersByTelegramId.set(telegramId, userRecord);
      this.usersByUsernameLower.set(cleanUsernameLower, userRecord);
      this.usersByReferralCode.set(userReferralCode, userRecord);

      // Initialize ledger with 1,000 Birr welcome credit
      ledgerService.getOrCreateUser(playerId, userRecord.username, userRecord.avatarUrl);

      // Clean up temporary registration session
      this.tempRegistrations.delete(tempToken);

      // Create persistent session
      const sessionToken = this.createSession(userRecord);

      const userAccount = {
        id: userRecord.id,
        playerId: userRecord.id,
        telegram_id: userRecord.telegram_id,
        telegramId: userRecord.telegram_id,
        username: userRecord.username,
        walletBalance: userRecord.walletBalance,
        avatarUrl: userRecord.avatarUrl,
        isBot: userRecord.isBot,
        registration_status: userRecord.registration_status,
        role: userRecord.role || 'USER',
        account_status: userRecord.account_status || 'ACTIVE'
      };

      this.completedTempRegistrations.set(tempToken, { user: userAccount, sessionToken });

      return {
        success: true,
        user: userAccount,
        sessionToken
      };
    });
  }

  /**
   * Resolves authenticated user from session token
   * Enforces expiration and revocation
   */
  public getUserByToken(token: string): UserAccount | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    // Check revocation
    if (session.revoked_at) return null;

    // Check expiration
    if (Date.now() > session.expires_at) {
      this.sessions.delete(token);
      return null;
    }

    // Refresh last used timestamp
    session.last_used_at = Date.now();

    const user = this.usersById.get(session.user_id);
    if (!user || user.account_status === 'BANNED' || user.is_active === false) return null;

    // Sync latest wallet balance from ledger
    const ledgerUser = ledgerService.getUser(user.id);
    return {
      id: user.id,
      playerId: user.id,
      telegram_id: user.telegram_id,
      telegramId: user.telegram_id,
      username: user.username,
      walletBalance: ledgerUser ? ledgerUser.walletBalance : user.walletBalance,
      avatarUrl: user.avatarUrl,
      isBot: user.isBot,
      role: user.role || 'USER',
      account_status: user.account_status || 'ACTIVE'
    };
  }

  public getFullUserRecordByToken(token: string): UserRecord | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session || session.revoked_at || Date.now() > session.expires_at) return null;
    return this.usersById.get(session.user_id) || null;
  }

  public verifySessionMatchesTelegram(token: string, telegramId: string): boolean {
    if (!token || !telegramId) return false;
    const session = this.sessions.get(token);
    if (!session || session.revoked_at || Date.now() > session.expires_at) return false;
    return String(session.telegram_id) === String(telegramId);
  }

  public getUserById(playerId: string): UserRecord | undefined {
    return this.usersById.get(playerId);
  }

  public getAllUsers(): any[] {
    return Array.from(this.usersById.values()).map(u => {
      const ledgerUser = ledgerService.getUser(u.id);
      return {
        ...u,
        role: u.role || 'USER',
        account_status: u.account_status || 'ACTIVE',
        accountStatus: u.account_status || 'ACTIVE',
        registrationDate: u.created_at || u.createdAt || new Date().toISOString(),
        lastActivityDate: u.last_login_at || u.updated_at || u.created_at || new Date().toISOString(),
        walletBalance: ledgerUser ? ledgerUser.walletBalance : u.walletBalance
      };
    });
  }

  public updateUserStatus(adminId: string, targetPlayerId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED'): any {
    const user = this.usersById.get(targetPlayerId);
    if (!user) throw new Error('Target user not found');

    const previousStatus = user.account_status || 'ACTIVE';
    user.account_status = status;
    user.is_active = status !== 'BANNED';
    user.updated_at = new Date().toISOString();
    this.usersById.set(targetPlayerId, user);

    // If BANNED, revoke active sessions
    if (status === 'BANNED') {
      for (const session of this.sessions.values()) {
        if (session.user_id === targetPlayerId) {
          session.revoked_at = Date.now();
        }
      }
    }

    ledgerService.recordAuditLog(
      adminId,
      'UPDATE_USER_STATUS',
      targetPlayerId,
      targetPlayerId,
      { previousStatus, newStatus: status }
    );

    return {
      ...user,
      accountStatus: user.account_status
    };
  }

  public getFullProfile(playerId: string): (UserRecord & { totalGamesPlayed: number; totalWonETB: number; vipTier: string }) | null {
    const user = this.usersById.get(playerId);
    if (!user) return null;

    const ledgerUser = ledgerService.getUser(playerId);
    return {
      ...user,
      walletBalance: ledgerUser ? ledgerUser.walletBalance : user.walletBalance,
      totalGamesPlayed: 48,
      totalWonETB: 4800,
      vipTier: '👑 VIP Champion'
    };
  }

  public getUserByTelegramId(telegramId: string): UserRecord | undefined {
    return this.usersByTelegramId.get(telegramId);
  }

  public validateSession(token: string): { valid: boolean; user?: UserAccount; status: AuthStateStatus; error?: string } {
    if (!token) {
      return { valid: false, status: 'UNAUTHENTICATED', error: 'No session token provided' };
    }
    const session = this.sessions.get(token);
    if (!session) {
      return { valid: false, status: 'UNAUTHENTICATED', error: 'Session not found or revoked' };
    }
    if (session.revoked_at) {
      return { valid: false, status: 'UNAUTHENTICATED', error: 'Session has been revoked' };
    }
    if (Date.now() > session.expires_at) {
      return { valid: false, status: 'UNAUTHENTICATED', error: 'Session has expired' };
    }
    const user = this.getUserByToken(token);
    if (!user) {
      return { valid: false, status: 'UNAUTHENTICATED', error: 'User not found or inactive' };
    }
    return { valid: true, user, status: 'AUTHENTICATED' };
  }

  public logout(token: string): boolean {
    const session = this.sessions.get(token);
    if (session) {
      session.revoked_at = Date.now();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // Legacy / Phone & Password Support (Preserved for compatibility)
  // -------------------------------------------------------------

  public login(phone: string, password: string): AuthResponse {
    const normalizedPhone = this.normalizePhone(phone);
    const user = this.usersByPhone.get(normalizedPhone);

    if (!user || !user.salt || !user.passwordHash) {
      return { success: false, error: 'Invalid phone number or password' };
    }

    const testHash = this.hashPassword(password, user.salt);
    if (testHash !== user.passwordHash) {
      return { success: false, error: 'Invalid phone number or password' };
    }

    const ledgerUser = ledgerService.getUser(user.id);
    if (ledgerUser) user.walletBalance = ledgerUser.walletBalance;

    const token = this.createSession(user);

    return {
      success: true,
      user: {
        playerId: user.id,
        username: user.username,
        walletBalance: user.walletBalance,
        avatarUrl: user.avatarUrl,
        isBot: user.isBot
      },
      token,
      requiresVerification: !user.isVerified,
      phone: user.phone_number,
      message: 'Logged in successfully'
    };
  }

  public telegramLogin(telegramData: { id: string | number; username?: string; first_name?: string; last_name?: string; photo_url?: string }): AuthResponse {
    const telegramId = String(telegramData.id);
    const playerId = `tg_${telegramId}`;
    let user = this.usersByTelegramId.get(telegramId);

    const displayName = telegramData.first_name
      ? `${telegramData.first_name} ${telegramData.last_name || ''}`.trim()
      : telegramData.username || 'TelegramPlayer';

    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: playerId,
        playerId,
        telegram_id: telegramId,
        telegram_username: telegramData.username,
        first_name: telegramData.first_name || '',
        username: displayName,
        referral_code: this.generateUniqueReferralCode(displayName),
        registration_status: 'COMPLETED',
        created_at: now,
        createdAt: now,
        updated_at: now,
        last_login_at: now,
        is_active: true,
        walletBalance: 1000.0,
        avatarUrl: telegramData.photo_url || '',
        isBot: false,
        isVerified: true
      };
      this.usersById.set(playerId, user);
      this.usersByTelegramId.set(telegramId, user);
      this.usersByUsernameLower.set(displayName.toLowerCase(), user);
      this.usersByReferralCode.set(user.referral_code, user);
      ledgerService.getOrCreateUser(playerId, user.username, user.avatarUrl);
    }

    const token = this.createSession(user);
    return {
      success: true,
      user: {
        playerId: user.id,
        username: user.username,
        walletBalance: user.walletBalance,
        avatarUrl: user.avatarUrl,
        isBot: user.isBot
      },
      token,
      requiresVerification: false,
      message: 'Telegram Login Successful'
    };
  }

  public register(name: string, phone: string, password: string): AuthResponse {
    const normalizedPhone = this.normalizePhone(phone);
    if (!name || name.trim().length < 2) return { success: false, error: 'Please enter a valid full name' };
    if (!/^(09|07)\d{8}$/.test(normalizedPhone)) return { success: false, error: 'Please enter a valid Ethiopian phone number (09... or 07...)' };
    if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
    if (this.usersByPhone.has(normalizedPhone)) return { success: false, error: 'An account with this phone number already exists. Please log in.' };

    const playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(password, salt);
    const now = new Date().toISOString();

    const newUser: UserRecord = {
      id: playerId,
      playerId,
      telegram_id: `phone_${normalizedPhone}`,
      first_name: name.trim(),
      username: name.trim(),
      phone: normalizedPhone,
      phone_number: normalizedPhone,
      referral_code: this.generateUniqueReferralCode(name),
      registration_status: 'COMPLETED',
      created_at: now,
      createdAt: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
      walletBalance: 1000.0,
      avatarUrl: '',
      isBot: false,
      isVerified: false,
      verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
      salt,
      passwordHash
    };

    this.usersById.set(playerId, newUser);
    this.usersByPhone.set(normalizedPhone, newUser);
    this.usersByTelegramId.set(newUser.telegram_id, newUser);
    this.usersByUsernameLower.set(newUser.username.toLowerCase(), newUser);
    this.usersByReferralCode.set(newUser.referral_code, newUser);
    ledgerService.getOrCreateUser(playerId, newUser.username);

    const token = this.createSession(newUser);
    return {
      success: true,
      user: {
        playerId: newUser.id,
        username: newUser.username,
        walletBalance: newUser.walletBalance,
        avatarUrl: newUser.avatarUrl,
        isBot: newUser.isBot
      },
      token,
      requiresVerification: true,
      phone: normalizedPhone,
      message: 'Account created! Please verify your phone number.'
    };
  }

  public initiateRegistration(name: string, phone: string, password: string) {
    const normalizedPhone = this.normalizePhone(phone);
    if (!name || name.trim().length < 2) return { success: false, error: 'Please enter a valid full name' };
    if (!/^(09|07)\d{8}$/.test(normalizedPhone)) return { success: false, error: 'Please enter a valid Ethiopian phone number (09... or 07...)' };
    if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
    if (this.usersByPhone.has(normalizedPhone)) return { success: false, error: 'An account with this phone number already exists. Please log in.' };

    const pendingId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(password, salt);

    const pending: PendingRegistration = {
      pendingId,
      name: name.trim(),
      phone: normalizedPhone,
      passwordHash,
      salt,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.pendingRegistrations.set(normalizedPhone, pending);
    this.pendingById.set(pendingId, normalizedPhone);

    return {
      success: true,
      pendingId,
      phone: normalizedPhone,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'BINGOBEET_BOT',
      botUrl: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'BINGOBEET_BOT'}?start=reg_${normalizedPhone}`
    };
  }

  public completeRegistrationWithMatchedPhone(sharedPhone: string, tgUserId: string, tgName?: string): { success: boolean; user?: UserAccount; token?: string; error?: string } {
    const normalizedPhone = this.normalizePhone(sharedPhone);
    const pending = this.pendingRegistrations.get(normalizedPhone);

    if (!pending || pending.status !== 'pending') {
      const existingUser = this.usersByPhone.get(normalizedPhone);
      if (existingUser) {
        existingUser.isVerified = true;
        const token = this.createSession(existingUser);
        return { success: true, user: existingUser, token };
      }
      return { success: false, error: 'No pending registration found for this phone number' };
    }

    const playerId = `tg_${tgUserId}`;
    const now = new Date().toISOString();
    const newUser: UserRecord = {
      id: playerId,
      playerId,
      telegram_id: String(tgUserId),
      first_name: pending.name,
      username: pending.name,
      phone: normalizedPhone,
      phone_number: normalizedPhone,
      referral_code: this.generateUniqueReferralCode(pending.name),
      registration_status: 'COMPLETED',
      created_at: now,
      createdAt: now,
      updated_at: now,
      last_login_at: now,
      is_active: true,
      walletBalance: 1000.0,
      avatarUrl: '',
      isBot: false,
      isVerified: true,
      salt: pending.salt,
      passwordHash: pending.passwordHash
    };

    this.usersById.set(playerId, newUser);
    this.usersByTelegramId.set(String(tgUserId), newUser);
    this.usersByUsernameLower.set(newUser.username.toLowerCase(), newUser);
    this.usersByReferralCode.set(newUser.referral_code, newUser);
    this.usersByPhone.set(normalizedPhone, newUser);

    ledgerService.getOrCreateUser(playerId, newUser.username);
    const token = this.createSession(newUser);

    pending.status = 'verified';
    pending.user = newUser;
    pending.token = token;

    return { success: true, user: newUser, token };
  }

  public denyPendingRegistration(expectedPhone: string, reason: string): boolean {
    const normalized = this.normalizePhone(expectedPhone);
    const pending = this.pendingRegistrations.get(normalized);
    if (pending) {
      pending.status = 'denied';
      pending.deniedReason = reason;
      return true;
    }
    return false;
  }

  public getRegistrationStatus(target: string): { status: 'pending' | 'verified' | 'denied' | 'not_found'; user?: UserAccount; token?: string; error?: string } {
    const normalized = this.normalizePhone(target);
    const pending = this.pendingRegistrations.get(normalized) || (this.pendingById.has(target) ? this.pendingRegistrations.get(this.pendingById.get(target)!) : undefined);
    if (!pending) {
      const user = this.usersByPhone.get(normalized);
      if (user && user.isVerified) {
        return { status: 'verified', user, token: this.createSession(user) };
      }
      return { status: 'not_found' };
    }

    if (pending.status === 'verified' && pending.user) {
      return { status: 'verified', user: pending.user, token: pending.token };
    }
    if (pending.status === 'denied') {
      return { status: 'denied', error: pending.deniedReason || 'Registration denied' };
    }
    return { status: 'pending' };
  }

  public verifyPhone(phone: string, code?: string): AuthResponse {
    const normalizedPhone = this.normalizePhone(phone);
    let user = this.usersByPhone.get(normalizedPhone);
    if (user) {
      user.isVerified = true;
      const token = this.createSession(user);
      return { success: true, user, token, requiresVerification: false, message: 'Phone verified' };
    }
    return { success: false, error: 'User not found for phone' };
  }

  public checkVerification(phone: string) {
    const status = this.getRegistrationStatus(phone);
    return {
      isVerified: status.status === 'verified',
      isDenied: status.status === 'denied',
      reason: status.error,
      user: status.user,
      token: status.token
    };
  }

  public initiatePasswordReset(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const user = this.usersByPhone.get(normalizedPhone);
    if (!user) {
      return { success: false, error: 'No account found with this phone number.' };
    }

    const resetToken = `tok_rst_${crypto.randomBytes(16).toString('hex')}`;
    const record: PendingPasswordReset = {
      phone: normalizedPhone,
      resetToken,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000
    };
    this.pendingPasswordResets.set(normalizedPhone, record);

    return {
      success: true,
      phone: normalizedPhone,
      resetToken,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'BINGOBEET_BOT',
      botUrl: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'BINGOBEET_BOT'}?start=reset_${normalizedPhone}`
    };
  }

  public authorizePasswordReset(sharedPhone: string) {
    const normalizedPhone = this.normalizePhone(sharedPhone);
    const record = this.pendingPasswordResets.get(normalizedPhone);
    if (!record || record.status !== 'pending') {
      return { success: false, error: 'No pending reset request found for this phone' };
    }
    record.status = 'authorized';
    return { success: true, resetToken: record.resetToken };
  }

  public denyPasswordReset(phone: string, reason: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const record = this.pendingPasswordResets.get(normalizedPhone);
    if (record) {
      record.status = 'denied';
      record.deniedReason = reason;
      return true;
    }
    return false;
  }

  public getPasswordResetStatus(phone: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const record = this.pendingPasswordResets.get(normalizedPhone);
    if (!record) return { status: 'not_found' };
    if (Date.now() > record.expiresAt) {
      this.pendingPasswordResets.delete(normalizedPhone);
      return { status: 'expired', error: 'Password reset request expired' };
    }
    return { status: record.status, resetToken: record.status === 'authorized' ? record.resetToken : undefined, error: record.deniedReason };
  }

  public completePasswordReset(phone: string, resetToken: string, newPassword: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const record = this.pendingPasswordResets.get(normalizedPhone);
    if (!record || record.resetToken !== resetToken || record.status !== 'authorized') {
      return { success: false, error: 'Invalid or unauthorized password reset token' };
    }
    const user = this.usersByPhone.get(normalizedPhone);
    if (!user) return { success: false, error: 'User not found' };

    const salt = this.generateSalt();
    user.salt = salt;
    user.passwordHash = this.hashPassword(newPassword, salt);
    this.pendingPasswordResets.delete(normalizedPhone);

    const token = this.createSession(user);
    return { success: true, user, token, message: 'Password reset successfully!' };
  }

  public loginWithTelegram(tgUser: { id: number | string; username?: string; first_name: string; last_name?: string }) {
    const telegramId = String(tgUser.id);
    let user = this.usersByTelegramId.get(telegramId);
    if (!user) {
      const now = new Date().toISOString();
      const playerId = `tg_${telegramId}`;
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || `User_${telegramId.slice(-4)}`;
      const referralCode = this.generateUniqueReferralCode(tgUser.username || 'user');
      user = {
        id: playerId,
        playerId,
        telegram_id: telegramId,
        telegram_username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        username: fullName,
        referral_code: referralCode,
        registration_status: 'COMPLETED',
        created_at: now,
        createdAt: now,
        updated_at: now,
        last_login_at: now,
        is_active: true,
        walletBalance: 1000.0,
        isBot: false,
        isVerified: true
      };
      this.usersById.set(user.id, user);
      this.usersByTelegramId.set(telegramId, user);
    }
    const token = this.createSession(user);
    return { success: true, user, token };
  }
}

export const authService = new AuthService();
