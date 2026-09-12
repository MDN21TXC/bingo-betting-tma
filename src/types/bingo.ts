export interface BingoGrid {
  B: number[];
  I: number[];
  N: number[];
  G: number[];
  O: number[];
}

export type CurrencyType = 'ETB';

export interface PurchasedTicket {
  ticketId: string;
  cardNumber?: number;
  playerId: string;
  username: string;
  grid: BingoGrid;
  fingerprintHash: string;
  purchasedAt: string;
  isBot?: boolean;
}

export interface WinnerRecord {
  ticketId: string;
  cardNumber?: number;
  playerId: string;
  username: string;
  patternsWon: string[];
  winningNumbers: Record<string, number[]>;
  payoutAmount: number;
  patternType: string;
  claimedAtBallIndex: number;
  isBot?: boolean;
}

export interface RoomSummary {
  roomId: string;
  roomName: string;
  betPerCard: number;
  etbEquivalent: number;
  badge?: string;
  status: 'lobby' | 'active' | 'finished';
  lobbyTimeRemaining: number;
  lobbyDuration: number;
  isCountdownActive?: boolean;
  activePlayersCount: number;
  totalCardsSold: number;
  totalCatalogCards: number;
  minCardsToStart: number;
  totalPot: number;
  winnerPayoutAmount: number;
  playerPayoutPool: number;
  isFivePlayerBonus: boolean;
  gameId: string;
}

export interface GameRoomState {
  roomId: string;
  roomName: string;
  gameId: string;
  status: 'lobby' | 'active' | 'finished';
  betPerCard: number;
  etbEquivalent: number;
  rakePercent: number;
  badge?: string;
  lobbyTimeRemaining: number;
  lobbyDuration: number;
  isCountdownActive?: boolean;
  drawIntervalMs: number;
  totalCatalogCards: number;
  minCardsToStart: number;
  commitmentHash: string;
  serverSeedRevealed?: string;
  fullShuffledBallsRevealed?: number[];
  drawnBalls: number[];
  currentBall: { letter: 'B' | 'I' | 'N' | 'G' | 'O'; number: number } | null;
  totalBallsToDraw: number;
  totalCardsSold: number;
  totalPot: number;
  houseRakeAmount: number;
  playerPayoutPool: number;
  winnerPayoutAmount: number;
  winnerPayoutPercent: number;
  isFivePlayerBonus: boolean;
  fullHousePot: number;
  linePot: number;
  fourCornersPot: number;
  takenCardNumbers?: Record<number, { playerId: string; username: string; isBot: boolean }>;
  tickets: PurchasedTicket[];
  activePlayersCount: number;
  winners: WinnerRecord[];
}

export interface UserAccount {
  id?: string;
  playerId: string;
  username: string;
  walletBalance: number;
  avatarUrl?: string;
  isBot?: boolean;
  phone?: string;
  isVerified?: boolean;
  registration_status?: string;
  role?: 'USER' | 'ADMIN';
  account_status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  token?: string;
  totalGamesPlayed?: number;
  totalWonETB?: number;
  vipTier?: string;
}

export interface LedgerEntry {
  id: string;
  playerId: string;
  username: string;
  type: 'deposit' | 'buy_in' | 'win_payout' | 'withdrawal' | 'refund' | 'bonus' | 'loss' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameId?: string;
  ticketId?: string;
  referenceId?: string;
  description: string;
  timestamp: string;
}

export interface LeaderboardWinner {
  rank: number;
  username: string;
  totalWonUSD: number;
  totalWonETB: number;
  gamesPlayed: number;
  badge: string;
}

export interface RecentJackpot {
  username: string;
  amountUSD: number;
  amountETB: number;
  pattern: string;
  timeAgo: string;
  room: string;
}

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  activeReferrals: number;
  totalEarnedUSD: number;
  totalEarnedETB: number;
  pendingClaimUSD: number;
  pendingClaimETB: number;
  commissionRate: string;
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

export interface AdminUserDetail {
  id: string;
  playerId: string;
  telegram_id: string;
  telegram_username?: string;
  first_name: string;
  last_name?: string;
  username: string;
  phone?: string;
  walletBalance: number;
  role: 'USER' | 'ADMIN';
  account_status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  registration_status: string;
  created_at: string;
  last_login_at: string;
}
