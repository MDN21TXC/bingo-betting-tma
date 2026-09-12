import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export interface UserRow {
  id: string;
  telegram_id: string;
  telegram_username?: string;
  first_name?: string;
  last_name?: string;
  username: string;
  phone?: string;
  password_hash?: string;
  password_salt?: string;
  referral_code: string;
  referred_by?: string;
  role: 'USER' | 'ADMIN';
  account_status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  registration_status: 'PENDING' | 'COMPLETED';
  avatar_url?: string;
  is_bot: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  telegram_id: string;
  created_at: number;
  expires_at: number;
  last_used_at: number;
  revoked_at?: number | null;
}

export interface WalletRow {
  user_id: string;
  balance: number;
  reserved_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerRow {
  id: string;
  user_id: string;
  username: string;
  type: 'DEPOSIT' | 'BET' | 'WIN_PAYOUT' | 'WITHDRAWAL' | 'REFUND' | 'BONUS' | 'LOSS' | 'ADMIN_ADJUSTMENT';
  amount: number;
  balance_before: number;
  balance_after: number;
  game_id?: string;
  ticket_id?: string;
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface DepositRow {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  payment_method: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reference_id?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  rejection_reason?: string;
}

export interface WithdrawalRow {
  id: string;
  user_id: string;
  username: string;
  amount: number;
  address: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  reference_id?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  rejection_reason?: string;
}

export interface GameRow {
  id: string;
  room_id: string;
  status: 'lobby' | 'active' | 'finished';
  bet_per_card: number;
  server_secret: string;
  commitment_hash: string;
  total_cards_sold: number;
  prize_pool: number;
  created_at: string;
  finished_at?: string;
}

export interface TicketRow {
  id: string;
  game_id: string;
  card_number: number;
  user_id: string;
  username: string;
  grid_json: string;
  fingerprint_hash: string;
  is_bot: number;
  purchased_at: string;
}

export interface ClaimRow {
  id: string;
  game_id: string;
  ticket_id: string;
  user_id: string;
  payout_amount: number;
  pattern_type: string;
  status: string;
  claimed_at: string;
}

export interface AuditRow {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id?: string;
  target_record_id?: string;
  metadata_json?: string;
  timestamp: string;
}

export class DatabaseService {
  private db: any;
  private isMemory: boolean;

  constructor(customPath?: string) {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    const dbPath = customPath || (isTest ? ':memory:' : path.resolve(process.cwd(), 'data', 'bingo.db'));

    this.isMemory = dbPath === ':memory:';

    if (!this.isMemory) {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (!this.isMemory) {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }

    const schemaPath = path.resolve(process.cwd(), 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schemaSql);
    }
  }

  private transactionDepth: number = 0;

  /**
   * Run operations inside an ACID transaction (supports re-entrant nested transactions)
   */
  public transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      this.transactionDepth++;
      try {
        return fn();
      } finally {
        this.transactionDepth--;
      }
    }

    this.transactionDepth = 1;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    } finally {
      this.transactionDepth = 0;
    }
  }

  // ==================== USER OPERATIONS ====================

  public createUser(user: {
    id: string;
    telegram_id: string;
    telegram_username?: string;
    first_name?: string;
    last_name?: string;
    username: string;
    phone?: string;
    password_hash?: string;
    password_salt?: string;
    referral_code: string;
    referred_by?: string;
    role?: 'USER' | 'ADMIN';
    account_status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
    registration_status?: 'PENDING' | 'COMPLETED';
    avatar_url?: string;
    is_bot?: boolean;
    created_at?: string;
  }): UserRow {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, telegram_id, telegram_username, first_name, last_name,
        username, phone, password_hash, password_salt, referral_code, referred_by, role,
        account_status, registration_status, avatar_url, is_bot,
        created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.telegram_id,
      user.telegram_username || null,
      user.first_name || null,
      user.last_name || null,
      user.username,
      user.phone || null,
      user.password_hash || null,
      user.password_salt || null,
      user.referral_code,
      user.referred_by || null,
      user.role || 'USER',
      user.account_status || 'ACTIVE',
      user.registration_status || 'COMPLETED',
      user.avatar_url || null,
      user.is_bot ? 1 : 0,
      user.created_at || now,
      now,
      now
    );

    // Automatically create empty wallet
    this.getOrCreateWallet(user.id);

    return this.getUserById(user.id)!;
  }

  public getUserById(id: string): UserRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as UserRow | undefined;
  }

  public getUserByTelegramId(telegramId: string): UserRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(String(telegramId)) as UserRow | undefined;
  }

  public getUserByUsername(username: string): UserRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    return stmt.get(username) as UserRow | undefined;
  }

  public getUserByReferralCode(code: string): UserRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE UPPER(referral_code) = UPPER(?)');
    return stmt.get(code) as UserRow | undefined;
  }

  public getUserByPhone(phone: string): UserRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE phone = ?');
    return stmt.get(phone) as UserRow | undefined;
  }

  public updateUser(
    id: string,
    updates: Partial<Omit<UserRow, 'id' | 'telegram_id' | 'created_at'>>
  ): UserRow {
    const allowed = [
      'telegram_username', 'first_name', 'last_name', 'username',
      'phone', 'referral_code', 'referred_by', 'role',
      'account_status', 'registration_status', 'avatar_url',
      'is_bot', 'last_login_at'
    ];

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(key === 'is_bot' ? (val ? 1 : 0) : val);
      }
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    return this.getUserById(id)!;
  }

  public getAllUsers(): UserRow[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as UserRow[];
  }

  // ==================== SESSION OPERATIONS ====================

  public createSession(userId: string, telegramId: string, ttlMs: number = 30 * 24 * 60 * 60 * 1000): SessionRow {
    const token = `tok_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, telegram_id, created_at, expires_at, last_used_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);

    stmt.run(token, userId, String(telegramId), now, expiresAt, now);

    return {
      id: token,
      user_id: userId,
      telegram_id: String(telegramId),
      created_at: now,
      expires_at: expiresAt,
      last_used_at: now,
      revoked_at: null
    };
  }

  public getSession(token: string): SessionRow | undefined {
    if (!token) return undefined;
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const session = stmt.get(token) as SessionRow | undefined;

    if (!session) return undefined;
    if (session.revoked_at || Date.now() > session.expires_at) return undefined;

    return session;
  }

  public getRawSession(token: string): SessionRow | undefined {
    if (!token) return undefined;
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(token) as SessionRow | undefined;
  }

  public touchSession(token: string): void {
    const stmt = this.db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?');
    stmt.run(Date.now(), token);
  }

  public revokeSession(token: string): void {
    const stmt = this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?');
    stmt.run(Date.now(), token);
  }

  public revokeAllUserSessions(userId: string): void {
    const stmt = this.db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL');
    stmt.run(Date.now(), userId);
  }

  // ==================== WALLET & LEDGER OPERATIONS ====================

  public getOrCreateWallet(userId: string, initialBalance: number = 0.0): WalletRow {
    const existing = this.getWallet(userId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO wallets (user_id, balance, reserved_balance, created_at, updated_at)
      VALUES (?, ?, 0.0, ?, ?)
    `);
    stmt.run(userId, initialBalance, now, now);

    return {
      user_id: userId,
      balance: initialBalance,
      reserved_balance: 0.0,
      created_at: now,
      updated_at: now
    };
  }

  public getWallet(userId: string): WalletRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM wallets WHERE user_id = ?');
    return stmt.get(userId) as WalletRow | undefined;
  }

  public updateWalletBalance(userId: string, balance: number, reserved: number = 0): void {
    this.getOrCreateWallet(userId);
    this.db.prepare(`UPDATE wallets SET balance = ?, reserved_balance = ?, updated_at = ? WHERE user_id = ?`)
      .run(balance, reserved, new Date().toISOString(), userId);
  }

  public recordLedgerTransaction(data: {
    userId: string;
    username: string;
    type: LedgerRow['type'];
    amount: number;
    description: string;
    gameId?: string;
    ticketId?: string;
    referenceId?: string;
  }): { entry: LedgerRow; wallet: WalletRow } {
    return this.transaction(() => {
      const wallet = this.getOrCreateWallet(data.userId);
      const balanceBefore = wallet.balance;
      let balanceAfter = balanceBefore;

      if (['DEPOSIT', 'WIN_PAYOUT', 'REFUND', 'BONUS', 'ADMIN_ADJUSTMENT'].includes(data.type)) {
        balanceAfter = balanceBefore + data.amount;
      } else if (['BET', 'WITHDRAWAL', 'LOSS'].includes(data.type)) {
        if (balanceBefore < data.amount) {
          throw new Error(`Insufficient wallet balance: required ${data.amount.toFixed(2)}, available ${balanceBefore.toFixed(2)}`);
        }
        balanceAfter = balanceBefore - data.amount;
      }

      if (balanceAfter < 0) {
        throw new Error(`Transaction would cause negative balance (${balanceAfter.toFixed(2)})`);
      }

      const entryId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date().toISOString();

      // Insert transaction record
      const txStmt = this.db.prepare(`
        INSERT INTO ledger_transactions (
          id, user_id, username, type, amount, balance_before, balance_after,
          game_id, ticket_id, reference_id, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      txStmt.run(
        entryId,
        data.userId,
        data.username,
        data.type,
        data.amount,
        balanceBefore,
        balanceAfter,
        data.gameId || null,
        data.ticketId || null,
        data.referenceId || null,
        data.description,
        now
      );

      // Update wallet balance
      const updateWalletStmt = this.db.prepare(`
        UPDATE wallets SET balance = ?, updated_at = ? WHERE user_id = ?
      `);
      updateWalletStmt.run(balanceAfter, now, data.userId);

      const updatedWallet = this.getWallet(data.userId)!;
      const entry: LedgerRow = {
        id: entryId,
        user_id: data.userId,
        username: data.username,
        type: data.type,
        amount: data.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        game_id: data.gameId,
        ticket_id: data.ticketId,
        reference_id: data.referenceId,
        description: data.description,
        created_at: now
      };

      return { entry, wallet: updatedWallet };
    });
  }

  public getLedgerForUser(userId: string): LedgerRow[] {
    const stmt = this.db.prepare('SELECT * FROM ledger_transactions WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as LedgerRow[];
  }

  public getAllLedgerTransactions(): LedgerRow[] {
    const stmt = this.db.prepare('SELECT * FROM ledger_transactions ORDER BY created_at DESC');
    return stmt.all() as LedgerRow[];
  }

  // ==================== DEPOSITS ====================

  public createDepositRequest(userId: string, username: string, amount: number, paymentMethod: string): DepositRow {
    const id = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO deposit_requests (
        id, user_id, username, amount, payment_method, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `);
    stmt.run(id, userId, username, amount, paymentMethod, now);

    return this.getDepositRequest(id)!;
  }

  public getDepositRequest(id: string): DepositRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM deposit_requests WHERE id = ?');
    return stmt.get(id) as DepositRow | undefined;
  }

  public getDepositRequests(status?: string): DepositRow[] {
    if (status) {
      const stmt = this.db.prepare('SELECT * FROM deposit_requests WHERE status = ? ORDER BY created_at DESC');
      return stmt.all(status) as DepositRow[];
    }
    const stmt = this.db.prepare('SELECT * FROM deposit_requests ORDER BY created_at DESC');
    return stmt.all() as DepositRow[];
  }

  public approveDeposit(adminId: string, depositId: string): { deposit: DepositRow; entry: LedgerRow; wallet: WalletRow } {
    return this.transaction(() => {
      const deposit = this.getDepositRequest(depositId);
      if (!deposit) throw new Error('Deposit request not found');
      if (deposit.status !== 'PENDING') throw new Error(`Deposit is already ${deposit.status}`);

      const now = new Date().toISOString();
      const updateStmt = this.db.prepare(`
        UPDATE deposit_requests
        SET status = 'APPROVED', processed_at = ?, processed_by = ?
        WHERE id = ?
      `);
      updateStmt.run(now, adminId, depositId);

      // Credit wallet and record ledger entry
      const { entry, wallet } = this.recordLedgerTransaction({
        userId: deposit.user_id,
        username: deposit.username,
        type: 'DEPOSIT',
        amount: deposit.amount,
        description: `Deposit via ${deposit.payment_method} approved by ${adminId}`,
        referenceId: `dep_appr_${depositId}`
      });

      this.recordAuditLog({
        adminUserId: adminId,
        action: 'APPROVE_DEPOSIT',
        targetUserId: deposit.user_id,
        targetRecordId: depositId,
        metadata: { amount: deposit.amount, paymentMethod: deposit.payment_method }
      });

      return { deposit: this.getDepositRequest(depositId)!, entry, wallet };
    });
  }

  public rejectDeposit(adminId: string, depositId: string, reason?: string): DepositRow {
    return this.transaction(() => {
      const deposit = this.getDepositRequest(depositId);
      if (!deposit) throw new Error('Deposit request not found');
      if (deposit.status !== 'PENDING') throw new Error(`Deposit is already ${deposit.status}`);

      const now = new Date().toISOString();
      const updateStmt = this.db.prepare(`
        UPDATE deposit_requests
        SET status = 'REJECTED', processed_at = ?, processed_by = ?, rejection_reason = ?
        WHERE id = ?
      `);
      updateStmt.run(now, adminId, reason || 'Rejected by administrator', depositId);

      this.recordAuditLog({
        adminUserId: adminId,
        action: 'REJECT_DEPOSIT',
        targetUserId: deposit.user_id,
        targetRecordId: depositId,
        metadata: { reason }
      });

      return this.getDepositRequest(depositId)!;
    });
  }

  // ==================== WITHDRAWALS ====================

  public createWithdrawalRequest(userId: string, username: string, amount: number, address: string): WithdrawalRow {
    return this.transaction(() => {
      const wallet = this.getOrCreateWallet(userId);
      if (wallet.balance < amount) {
        throw new Error(`Insufficient funds: balance is ${wallet.balance.toFixed(2)}, cannot withdraw ${amount.toFixed(2)}`);
      }

      const now = new Date().toISOString();
      const newBalance = wallet.balance - amount;
      const newReserved = wallet.reserved_balance + amount;

      // Reserve funds immediately
      this.db.prepare(`
        UPDATE wallets SET balance = ?, reserved_balance = ?, updated_at = ? WHERE user_id = ?
      `).run(newBalance, newReserved, now, userId);

      const id = `wth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const stmt = this.db.prepare(`
        INSERT INTO withdrawal_requests (
          id, user_id, username, amount, address, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
      `);
      stmt.run(id, userId, username, amount, address, now);

      return this.getWithdrawalRequest(id)!;
    });
  }

  public getWithdrawalRequest(id: string): WithdrawalRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?');
    return stmt.get(id) as WithdrawalRow | undefined;
  }

  public getWithdrawalRequests(status?: string): WithdrawalRow[] {
    if (status) {
      const stmt = this.db.prepare('SELECT * FROM withdrawal_requests WHERE status = ? ORDER BY created_at DESC');
      return stmt.all(status) as WithdrawalRow[];
    }
    const stmt = this.db.prepare('SELECT * FROM withdrawal_requests ORDER BY created_at DESC');
    return stmt.all() as WithdrawalRow[];
  }

  public approveWithdrawal(adminId: string, withdrawalId: string): { withdrawal: WithdrawalRow; entry: LedgerRow; wallet: WalletRow } {
    return this.transaction(() => {
      const withdrawal = this.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) throw new Error('Withdrawal request not found');
      if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'PROCESSING') {
        throw new Error(`Withdrawal is already ${withdrawal.status}`);
      }

      const wallet = this.getWallet(withdrawal.user_id);
      if (!wallet || wallet.reserved_balance < withdrawal.amount) {
        throw new Error('Integrity error: reserved balance mismatch');
      }

      const now = new Date().toISOString();
      // Deduct from reserved balance
      const newReserved = wallet.reserved_balance - withdrawal.amount;
      this.db.prepare(`
        UPDATE wallets SET reserved_balance = ?, updated_at = ? WHERE user_id = ?
      `).run(newReserved, now, withdrawal.user_id);

      // Mark completed
      this.db.prepare(`
        UPDATE withdrawal_requests
        SET status = 'COMPLETED', processed_at = ?, processed_by = ?
        WHERE id = ?
      `).run(now, adminId, withdrawalId);

      // Record withdrawal ledger entry
      const entryId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.db.prepare(`
        INSERT INTO ledger_transactions (
          id, user_id, username, type, amount, balance_before, balance_after,
          reference_id, description, created_at
        ) VALUES (?, ?, ?, 'WITHDRAWAL', ?, ?, ?, ?, ?, ?)
      `).run(
        entryId,
        withdrawal.user_id,
        withdrawal.username,
        withdrawal.amount,
        wallet.balance + withdrawal.amount,
        wallet.balance,
        `wth_comp_${withdrawalId}`,
        `Withdrawal to ${withdrawal.address} approved by ${adminId}`,
        now
      );

      this.recordAuditLog({
        adminUserId: adminId,
        action: 'APPROVE_WITHDRAWAL',
        targetUserId: withdrawal.user_id,
        targetRecordId: withdrawalId,
        metadata: { amount: withdrawal.amount, address: withdrawal.address }
      });

      const entry: LedgerRow = {
        id: entryId,
        user_id: withdrawal.user_id,
        username: withdrawal.username,
        type: 'WITHDRAWAL',
        amount: withdrawal.amount,
        balance_before: wallet.balance + withdrawal.amount,
        balance_after: wallet.balance,
        reference_id: `wth_comp_${withdrawalId}`,
        description: `Withdrawal to ${withdrawal.address} approved by ${adminId}`,
        created_at: now
      };

      return {
        withdrawal: this.getWithdrawalRequest(withdrawalId)!,
        entry,
        wallet: this.getWallet(withdrawal.user_id)!
      };
    });
  }

  public rejectWithdrawal(adminId: string, withdrawalId: string, reason?: string): WithdrawalRow {
    return this.transaction(() => {
      const withdrawal = this.getWithdrawalRequest(withdrawalId);
      if (!withdrawal) throw new Error('Withdrawal request not found');
      if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'PROCESSING') {
        throw new Error(`Withdrawal is already ${withdrawal.status}`);
      }

      const wallet = this.getWallet(withdrawal.user_id);
      if (!wallet || wallet.reserved_balance < withdrawal.amount) {
        throw new Error('Integrity error: reserved balance mismatch');
      }

      const now = new Date().toISOString();
      // Restore funds to active balance
      const newBalance = wallet.balance + withdrawal.amount;
      const newReserved = wallet.reserved_balance - withdrawal.amount;

      this.db.prepare(`
        UPDATE wallets SET balance = ?, reserved_balance = ?, updated_at = ? WHERE user_id = ?
      `).run(newBalance, newReserved, now, withdrawal.user_id);

      this.db.prepare(`
        UPDATE withdrawal_requests
        SET status = 'REJECTED', processed_at = ?, processed_by = ?, rejection_reason = ?
        WHERE id = ?
      `).run(now, adminId, reason || 'Rejected by administrator', withdrawalId);

      this.recordAuditLog({
        adminUserId: adminId,
        action: 'REJECT_WITHDRAWAL',
        targetUserId: withdrawal.user_id,
        targetRecordId: withdrawalId,
        metadata: { reason, refundedAmount: withdrawal.amount }
      });

      return this.getWithdrawalRequest(withdrawalId)!;
    });
  }

  // ==================== GAMES & TICKETS ====================

  public createGame(game: {
    id: string;
    roomId: string;
    betPerCard: number;
    serverSecret: string;
    commitmentHash: string;
  }): GameRow {
    const now = new Date().toISOString();
    const existing = this.getGame(game.id);
    if (existing) return existing;

    const stmt = this.db.prepare(`
      INSERT INTO games (
        id, room_id, status, bet_per_card, server_secret, commitment_hash, total_cards_sold, prize_pool, created_at
      ) VALUES (?, ?, 'lobby', ?, ?, ?, 0, 0.0, ?)
    `);
    stmt.run(game.id, game.roomId, game.betPerCard, game.serverSecret, game.commitmentHash, now);
    return this.getGame(game.id)!;
  }

  public getGame(id: string): GameRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM games WHERE id = ?');
    return stmt.get(id) as GameRow | undefined;
  }

  public updateGame(id: string, updates: Partial<GameRow>): void {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [k, v] of Object.entries(updates)) {
      if (['status', 'total_cards_sold', 'prize_pool', 'finished_at'].includes(k)) {
        fields.push(`${k} = ?`);
        values.push(v);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  public createPlayerTicket(ticket: {
    id: string;
    gameId: string;
    cardNumber: number;
    userId: string;
    username: string;
    gridJson: string;
    fingerprintHash: string;
    isBot?: boolean;
  }): TicketRow {
    const now = new Date().toISOString();
    const existing = this.getPlayerTicket(ticket.id);
    if (existing) return existing;

    // Ensure referenced game exists in DB
    if (!this.getGame(ticket.gameId)) {
      this.createGame({
        id: ticket.gameId,
        roomId: 'room_default',
        betPerCard: 20,
        serverSecret: 'sec_default',
        commitmentHash: 'hash_default'
      });
    }

    const stmt = this.db.prepare(`
      INSERT INTO player_tickets (
        id, game_id, card_number, user_id, username, grid_json, fingerprint_hash, is_bot, purchased_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      ticket.id,
      ticket.gameId,
      ticket.cardNumber,
      ticket.userId,
      ticket.username,
      ticket.gridJson,
      ticket.fingerprintHash,
      ticket.isBot ? 1 : 0,
      now
    );

    return {
      id: ticket.id,
      game_id: ticket.gameId,
      card_number: ticket.cardNumber,
      user_id: ticket.userId,
      username: ticket.username,
      grid_json: ticket.gridJson,
      fingerprint_hash: ticket.fingerprintHash,
      is_bot: ticket.isBot ? 1 : 0,
      purchased_at: now
    };
  }

  public getPlayerTicket(ticketId: string): TicketRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM player_tickets WHERE id = ?');
    return stmt.get(ticketId) as TicketRow | undefined;
  }

  // ==================== BINGO CLAIMS (IDEMPOTENT) ====================

  public recordBingoClaim(claim: {
    gameId: string;
    ticketId: string;
    userId: string;
    payoutAmount: number;
    patternType: string;
  }): ClaimRow {
    const id = `clm_${claim.gameId}_${claim.ticketId}`;
    const now = new Date().toISOString();

    // Ensure referenced game and ticket exist in DB
    if (!this.getGame(claim.gameId)) {
      this.createGame({
        id: claim.gameId,
        roomId: 'room_default',
        betPerCard: 20,
        serverSecret: 'sec_default',
        commitmentHash: 'hash_default'
      });
    }
    if (!this.getPlayerTicket(claim.ticketId)) {
      this.createPlayerTicket({
        id: claim.ticketId,
        gameId: claim.gameId,
        cardNumber: 1,
        userId: claim.userId,
        username: 'Player',
        gridJson: '{}',
        fingerprintHash: 'hash_claim'
      });
    }

    const stmt = this.db.prepare(`
      INSERT INTO bingo_claims (
        id, game_id, ticket_id, user_id, payout_amount, pattern_type, status, claimed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'VERIFIED', ?)
    `);

    stmt.run(id, claim.gameId, claim.ticketId, claim.userId, claim.payoutAmount, claim.patternType, now);

    return {
      id,
      game_id: claim.gameId,
      ticket_id: claim.ticketId,
      user_id: claim.userId,
      payout_amount: claim.payoutAmount,
      pattern_type: claim.patternType,
      status: 'VERIFIED',
      claimed_at: now
    };
  }

  public getBingoClaim(gameId: string, ticketId: string): ClaimRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM bingo_claims WHERE game_id = ? AND ticket_id = ?');
    return stmt.get(gameId, ticketId) as ClaimRow | undefined;
  }

  // ==================== AUDIT LOGS ====================

  public recordAuditLog(log: {
    adminUserId: string;
    action: string;
    targetUserId?: string;
    targetRecordId?: string;
    metadata?: Record<string, any>;
  }): AuditRow {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const metaJson = log.metadata ? JSON.stringify(log.metadata) : null;

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, admin_user_id, action, target_user_id, target_record_id, metadata_json, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, log.adminUserId, log.action, log.targetUserId || null, log.targetRecordId || null, metaJson, now);

    return {
      id,
      admin_user_id: log.adminUserId,
      action: log.action,
      target_user_id: log.targetUserId,
      target_record_id: log.targetRecordId,
      metadata_json: metaJson || undefined,
      timestamp: now
    };
  }

  public getAuditLogs(): AuditRow[] {
    const stmt = this.db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    return stmt.all() as AuditRow[];
  }

  /**
   * Reset database (primarily for clean test suite runs)
   */
  public resetDatabase(): void {
    this.db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM bingo_claims;
      DELETE FROM player_tickets;
      DELETE FROM game_rounds;
      DELETE FROM games;
      DELETE FROM withdrawal_requests;
      DELETE FROM deposit_requests;
      DELETE FROM ledger_transactions;
      DELETE FROM wallets;
      DELETE FROM sessions;
      DELETE FROM telegram_accounts;
      DELETE FROM users;
    `);
  }
}

export const databaseService = new DatabaseService();
