export type UserRole = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface UserAccount {
  id?: string;
  playerId: string;
  telegram_id?: string;
  telegramId?: string;
  username: string;
  walletBalance: number;
  avatarUrl?: string;
  isBot?: boolean;
  registration_status?: string;
  role?: UserRole;
  account_status?: AccountStatus;
  phone?: string;
}

export type LedgerTransactionType =
  | 'deposit'
  | 'buy_in'
  | 'win_payout'
  | 'withdrawal'
  | 'refund'
  | 'bonus'
  | 'loss'
  | 'adjustment';

export interface LedgerEntry {
  id: string;
  playerId: string;
  username: string;
  type: LedgerTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameId?: string;
  ticketId?: string;
  referenceId?: string;
  description: string;
  timestamp: string;
}

export interface DepositRequest {
  id: string;
  playerId: string;
  username: string;
  amount: number;
  paymentMethod: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  referenceId?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  rejectionReason?: string;
}

export interface WithdrawalRequest {
  id: string;
  playerId: string;
  username: string;
  amount: number;
  address: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  referenceId?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
  rejectionReason?: string;
}

export interface AuditLogRecord {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string;
  target_record_id: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class LedgerService {
  private users: Map<string, UserAccount> = new Map();
  private ledger: LedgerEntry[] = [];
  private depositRequests: Map<string, DepositRequest> = new Map();
  private withdrawalRequests: Map<string, WithdrawalRequest> = new Map();
  private auditLogs: AuditLogRecord[] = [];
  private processedReferences: Set<string> = new Set();
  private lockQueues: Map<string, Promise<void>> = new Map();

  constructor() {
    // Seed initial users from specification blueprint (page 7)
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const seedUsers: UserAccount[] = [
      { playerId: 'usr_admin', username: 'admin', walletBalance: 50000.00, isBot: false, role: 'ADMIN', account_status: 'ACTIVE' },
      { playerId: 'usr_me', username: 'TelegramPlayer', walletBalance: 1000.00, isBot: false, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0001', username: 'CryptoWhale_99', walletBalance: 2500.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0002', username: 'LuckyStrike_TON', walletBalance: 1800.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0003', username: 'BingoQueen_VIP', walletBalance: 3200.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0004', username: 'DiamondHands_7', walletBalance: 1000.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0005', username: 'CyberGambler', walletBalance: 1400.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0006', username: 'RocketMan_Durov', walletBalance: 4000.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
      { playerId: 'usr_0007', username: 'GoldenTicket', walletBalance: 900.00, isBot: true, role: 'USER', account_status: 'ACTIVE' },
    ];

    for (const u of seedUsers) {
      this.users.set(u.playerId, u);
    }
  }

  /**
   * Acquire an atomic lock on a user's account to guarantee ACID transaction serialization
   */
  private async withLock<T>(playerId: string, action: () => Promise<T> | T): Promise<T> {
    const currentLock = this.lockQueues.get(playerId) || Promise.resolve();
    let releaseLock: () => void = () => {};
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.lockQueues.set(playerId, nextLock);

    try {
      await currentLock;
      return await action();
    } finally {
      releaseLock();
      if (this.lockQueues.get(playerId) === nextLock) {
        this.lockQueues.delete(playerId);
      }
    }
  }

  public getUser(playerId: string): UserAccount | undefined {
    return this.users.get(playerId);
  }

  public getOrCreateUser(playerId: string, username: string, avatarUrl?: string, role: UserRole = 'USER'): UserAccount {
    let user = this.users.get(playerId);
    if (!user) {
      user = {
        playerId,
        username,
        walletBalance: 1000.00,
        avatarUrl,
        isBot: false,
        role,
        account_status: 'ACTIVE'
      };
      this.users.set(playerId, user);
      // Record initial welcome deposit in ledger
      this.recordTransaction(playerId, 'deposit', 1000.00, 'Welcome bonus deposit');
    }
    return user;
  }

  public getAllUsers(): UserAccount[] {
    return Array.from(this.users.values());
  }

  public getLedgerForUser(playerId: string): LedgerEntry[] {
    return this.ledger.filter(entry => entry.playerId === playerId).reverse();
  }

  public getAllLedgerEntries(): LedgerEntry[] {
    return [...this.ledger].reverse();
  }

  /**
   * ACID Transaction: Record an atomic wallet ledger mutation
   */
  public async recordTransaction(
    playerId: string,
    type: LedgerTransactionType,
    amount: number,
    description: string,
    gameId?: string,
    ticketId?: string,
    referenceId?: string
  ): Promise<LedgerEntry> {
    return this.withLock(playerId, async () => {
      // Prevent double processing if referenceId was already executed
      if (referenceId && this.processedReferences.has(referenceId)) {
        const existingEntry = this.ledger.find(e => e.referenceId === referenceId);
        if (existingEntry) return existingEntry;
      }

      let user = this.users.get(playerId);
      if (!user) {
        user = this.getOrCreateUser(playerId, 'TelegramPlayer');
      }

      const balanceBefore = Number(user.walletBalance.toFixed(2));
      let balanceAfter = balanceBefore;

      if (type === 'buy_in' || type === 'withdrawal' || type === 'loss') {
        if (balanceBefore < amount) {
          throw new Error(`Insufficient funds: Balance is $${balanceBefore.toFixed(2)}, required $${amount.toFixed(2)}`);
        }
        balanceAfter = Number((balanceBefore - amount).toFixed(2));
      } else if (type === 'deposit' || type === 'win_payout' || type === 'refund' || type === 'bonus') {
        balanceAfter = Number((balanceBefore + amount).toFixed(2));
      } else if (type === 'adjustment') {
        // Can be positive or negative
        balanceAfter = Number((balanceBefore + amount).toFixed(2));
        if (balanceAfter < 0) {
          throw new Error(`Adjustment would result in negative balance ($${balanceAfter.toFixed(2)})`);
        }
      }

      user.walletBalance = balanceAfter;
      this.users.set(playerId, user);

      if (referenceId) {
        this.processedReferences.add(referenceId);
      }

      const entry: LedgerEntry = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        playerId,
        username: user.username,
        type,
        amount: Number(Math.abs(amount).toFixed(2)),
        balanceBefore,
        balanceAfter,
        gameId,
        ticketId,
        referenceId,
        description,
        timestamp: new Date().toISOString()
      };

      this.ledger.push(entry);
      return entry;
    });
  }

  // ---------------- Deposits & Withdrawals Workflows ----------------

  public createDepositRequest(
    playerId: string,
    username: string,
    amount: number,
    paymentMethod: string,
    referenceId?: string
  ): DepositRequest {
    const id = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const deposit: DepositRequest = {
      id,
      playerId,
      username,
      amount,
      paymentMethod,
      status: 'PENDING',
      referenceId,
      createdAt: new Date().toISOString()
    };
    this.depositRequests.set(id, deposit);
    return deposit;
  }

  public getDepositRequests(status?: string): DepositRequest[] {
    const all = Array.from(this.depositRequests.values()).reverse();
    if (status) {
      return all.filter(d => d.status.toUpperCase() === status.toUpperCase());
    }
    return all;
  }

  public async approveDeposit(adminId: string, depositId: string): Promise<{ deposit: DepositRequest; entry: LedgerEntry }> {
    const deposit = this.depositRequests.get(depositId);
    if (!deposit) throw new Error('Deposit request not found');
    if (deposit.status !== 'PENDING') throw new Error(`Deposit already ${deposit.status.toLowerCase()}`);

    const entry = await this.recordTransaction(
      deposit.playerId,
      'deposit',
      deposit.amount,
      `Deposit approved via ${deposit.paymentMethod}`,
      undefined,
      undefined,
      deposit.referenceId || deposit.id
    );

    deposit.status = 'APPROVED';
    deposit.processedAt = new Date().toISOString();
    deposit.processedBy = adminId;
    this.depositRequests.set(depositId, deposit);

    this.recordAuditLog(
      adminId,
      'APPROVE_DEPOSIT',
      deposit.playerId,
      depositId,
      { amount: deposit.amount, paymentMethod: deposit.paymentMethod }
    );

    return { deposit, entry };
  }

  public rejectDeposit(adminId: string, depositId: string, reason?: string): DepositRequest {
    const deposit = this.depositRequests.get(depositId);
    if (!deposit) throw new Error('Deposit request not found');
    if (deposit.status !== 'PENDING') throw new Error(`Deposit already ${deposit.status.toLowerCase()}`);

    deposit.status = 'REJECTED';
    deposit.processedAt = new Date().toISOString();
    deposit.processedBy = adminId;
    deposit.rejectionReason = reason || 'Declined by administrator';
    this.depositRequests.set(depositId, deposit);

    this.recordAuditLog(
      adminId,
      'REJECT_DEPOSIT',
      deposit.playerId,
      depositId,
      { amount: deposit.amount, reason: deposit.rejectionReason }
    );

    return deposit;
  }

  public createWithdrawalRequest(
    playerId: string,
    username: string,
    amount: number,
    address: string,
    referenceId?: string
  ): WithdrawalRequest {
    const user = this.getUser(playerId);
    if (!user || user.walletBalance < amount) {
      throw new Error(`Insufficient funds for withdrawal request`);
    }

    const id = `wd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const withdrawal: WithdrawalRequest = {
      id,
      playerId,
      username,
      amount,
      address,
      status: 'PENDING',
      referenceId,
      createdAt: new Date().toISOString()
    };
    this.withdrawalRequests.set(id, withdrawal);
    return withdrawal;
  }

  public getWithdrawalRequests(status?: string): WithdrawalRequest[] {
    const all = Array.from(this.withdrawalRequests.values()).reverse();
    if (status) {
      return all.filter(w => w.status.toUpperCase() === status.toUpperCase());
    }
    return all;
  }

  public async approveWithdrawal(adminId: string, withdrawalId: string): Promise<{ withdrawal: WithdrawalRequest; entry: LedgerEntry }> {
    const withdrawal = this.withdrawalRequests.get(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found');
    if (withdrawal.status !== 'PENDING') throw new Error(`Withdrawal already ${withdrawal.status.toLowerCase()}`);

    const entry = await this.recordTransaction(
      withdrawal.playerId,
      'withdrawal',
      withdrawal.amount,
      `Withdrawal paid to ${withdrawal.address}`,
      undefined,
      undefined,
      withdrawal.referenceId || withdrawal.id
    );

    withdrawal.status = 'APPROVED';
    withdrawal.processedAt = new Date().toISOString();
    withdrawal.processedBy = adminId;
    this.withdrawalRequests.set(withdrawalId, withdrawal);

    this.recordAuditLog(
      adminId,
      'APPROVE_WITHDRAWAL',
      withdrawal.playerId,
      withdrawalId,
      { amount: withdrawal.amount, address: withdrawal.address }
    );

    return { withdrawal, entry };
  }

  public rejectWithdrawal(adminId: string, withdrawalId: string, reason?: string): WithdrawalRequest {
    const withdrawal = this.withdrawalRequests.get(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found');
    if (withdrawal.status !== 'PENDING') throw new Error(`Withdrawal already ${withdrawal.status.toLowerCase()}`);

    withdrawal.status = 'REJECTED';
    withdrawal.processedAt = new Date().toISOString();
    withdrawal.processedBy = adminId;
    withdrawal.rejectionReason = reason || 'Declined by administrator';
    this.withdrawalRequests.set(withdrawalId, withdrawal);

    this.recordAuditLog(
      adminId,
      'REJECT_WITHDRAWAL',
      withdrawal.playerId,
      withdrawalId,
      { amount: withdrawal.amount, reason: withdrawal.rejectionReason }
    );

    return withdrawal;
  }

  public async manualBalanceAdjustment(
    adminId: string,
    targetPlayerId: string,
    amount: number,
    reason: string
  ): Promise<{ user: UserAccount; entry: LedgerEntry }> {
    const entry = await this.recordTransaction(
      targetPlayerId,
      'adjustment',
      amount,
      `Admin adjustment: ${reason}`
    );

    const user = this.getUser(targetPlayerId)!;

    this.recordAuditLog(
      adminId,
      'MANUAL_BALANCE_ADJUSTMENT',
      targetPlayerId,
      entry.id,
      { amount, reason, newBalance: user.walletBalance }
    );

    return { user, entry };
  }

  // ---------------- Audit Logging ----------------

  public recordAuditLog(
    adminId: string,
    action: string,
    targetUserId: string,
    targetRecordId: string,
    metadata?: Record<string, any>
  ): AuditLogRecord {
    const log: AuditLogRecord = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      admin_user_id: adminId,
      action,
      target_user_id: targetUserId,
      target_record_id: targetRecordId,
      timestamp: new Date().toISOString(),
      metadata
    };
    this.auditLogs.unshift(log);
    return log;
  }

  public getAuditLogs(limit: number = 100): AuditLogRecord[] {
    return this.auditLogs.slice(0, limit);
  }
}

export const ledgerService = new LedgerService();
