-- Focus AI veritabanı şeması
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Kullanıcılar
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(120),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

-- E-posta doğrulama / 2FA kodları (OTP)
CREATE TABLE IF NOT EXISTS email_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash       VARCHAR(255) NOT NULL,           -- OTP düz değil, hash'li saklanır
    purpose         VARCHAR(30) NOT NULL DEFAULT 'register', -- register | login_2fa | reset
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    attempts        INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);

-- Giriş kayıtları (admin görür: kim, ne zaman, hangi IP)
CREATE TABLE IF NOT EXISTS login_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    email           VARCHAR(255),
    success         BOOLEAN NOT NULL,
    reason          VARCHAR(120),                    -- başarısızsa neden
    ip_address      VARCHAR(64),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at DESC);

-- Refresh token'lar (oturum yönetimi / çıkış)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- Odak oturumları (uygulamadan senkronlanır — ileride istatistik için)
CREATE TABLE IF NOT EXISTS focus_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at          TIMESTAMPTZ NOT NULL,
    duration_seconds    INT NOT NULL DEFAULT 0,
    focus_score         INT,
    exit_count          INT NOT NULL DEFAULT 0,
    interaction_count   INT NOT NULL DEFAULT 0,
    phone_detected_count INT NOT NULL DEFAULT 0,
    mode                VARCHAR(30),                 -- serbest | pomodoro | mum
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id);
