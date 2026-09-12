-- ====================================================================
-- Bingo Telegram Mini App - PostgreSQL Schema
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    telegram_id VARCHAR(64) NOT NULL UNIQUE,
    telegram_username VARCHAR(128),
    first_name VARCHAR(128),
    last_name VARCHAR(128),
    username VARCHAR(64) NOT NULL UNIQUE,
    phone VARCHAR(32),
    password_hash VARCHAR(256),
    password_salt VARCHAR(64),
    referral_code VARCHAR(32) NOT NULL UNIQUE,
    referred_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'USER' CHECK(role IN ('USER', 'ADMIN')),
    account_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
    registration_status VARCHAR(16) NOT NULL DEFAULT 'COMPLETED' CHECK(registration_status IN ('PENDING', 'COMPLETED')),
    avatar_url TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pg_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_pg_users_username ON users(username);

CREATE TABLE IF NOT EXISTS telegram_accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id VARCHAR(64) NOT NULL UNIQUE,
    first_name VARCHAR(128),
    last_name VARCHAR(128),
    username VARCHAR(128),
    photo_url TEXT,
    auth_date BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    last_used_at BIGINT NOT NULL,
    revoked_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pg_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_sessions_telegram_id ON sessions(telegram_id);

CREATE TABLE IF NOT EXISTS wallets (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK(balance >= 0.00),
    reserved_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK(reserved_balance >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK(type IN ('DEPOSIT', 'BET', 'WIN_PAYOUT', 'WITHDRAWAL', 'REFUND', 'BONUS', 'LOSS', 'ADMIN_ADJUSTMENT')),
    amount NUMERIC(14, 2) NOT NULL,
    balance_before NUMERIC(14, 2) NOT NULL,
    balance_after NUMERIC(14, 2) NOT NULL,
    game_id VARCHAR(64),
    ticket_id VARCHAR(64),
    reference_id VARCHAR(128) UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_ledger_user ON ledger_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pg_ledger_reference ON ledger_transactions(reference_id);

CREATE TABLE IF NOT EXISTS deposit_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK(amount > 0),
    payment_method VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by VARCHAR(64),
    rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK(amount > 0),
    address VARCHAR(256) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    reference_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by VARCHAR(64),
    rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(64) PRIMARY KEY,
    room_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK(status IN ('lobby', 'active', 'finished')),
    bet_per_card NUMERIC(14, 2) NOT NULL,
    server_secret TEXT NOT NULL,
    commitment_hash TEXT NOT NULL,
    total_cards_sold INT NOT NULL DEFAULT 0,
    prize_pool NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS game_rounds (
    id VARCHAR(64) PRIMARY KEY,
    game_id VARCHAR(64) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ball_index INT NOT NULL,
    ball_number INT NOT NULL,
    ball_letter VARCHAR(2) NOT NULL,
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_tickets (
    id VARCHAR(64) PRIMARY KEY,
    game_id VARCHAR(64) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    card_number INT NOT NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    grid_json JSONB NOT NULL,
    fingerprint_hash VARCHAR(128) NOT NULL,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(game_id, card_number)
);

CREATE TABLE IF NOT EXISTS bingo_claims (
    id VARCHAR(64) PRIMARY KEY,
    game_id VARCHAR(64) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ticket_id VARCHAR(64) NOT NULL REFERENCES player_tickets(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payout_amount NUMERIC(14, 2) NOT NULL,
    pattern_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(game_id, ticket_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    admin_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    target_user_id VARCHAR(64),
    target_record_id VARCHAR(64),
    metadata_json JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Pending Registrations table (PostgreSQL)
CREATE TABLE IF NOT EXISTS pending_registrations (
    id VARCHAR(64) PRIMARY KEY,
    phone VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    telegram_user_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'VERIFIED', 'DENIED', 'EXPIRED')),
    denial_reason VARCHAR(256),
    created_at VARCHAR(64) NOT NULL,
    expires_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pg_pending_reg_phone ON pending_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_pg_pending_reg_telegram_id ON pending_registrations(telegram_user_id);
