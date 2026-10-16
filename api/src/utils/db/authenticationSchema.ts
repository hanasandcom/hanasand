import run from '#db'

export default async function ensureAuthenticationSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS login_events (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_id INT,
                ip TEXT NOT NULL,
                user_agent TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                reason TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS passkey_challenges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                purpose TEXT NOT NULL CHECK (purpose IN ('register', 'authenticate')),
                challenge TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                consumed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_passkey_challenges_active ON passkey_challenges(purpose, expires_at DESC) WHERE consumed_at IS NULL')
    await run(`
            CREATE TABLE IF NOT EXISTS user_passkeys (
                credential_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                public_key_cose TEXT NOT NULL,
                sign_count BIGINT NOT NULL DEFAULT 0,
                alg INT NOT NULL,
                aaguid TEXT NOT NULL DEFAULT '',
                label TEXT NOT NULL DEFAULT 'Passkey',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_used_at TIMESTAMPTZ
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_created ON user_passkeys(user_id, created_at DESC)')
}
