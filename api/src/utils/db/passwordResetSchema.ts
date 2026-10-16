import run from '#db'

export default async function ensurePasswordResetSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS password_reset_codes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                code_hash TEXT NOT NULL,
                reset_token_hash TEXT,
                requested_ip TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT '',
                attempts INT NOT NULL DEFAULT 0,
                expires_at TIMESTAMPTZ NOT NULL,
                verified_at TIMESTAMPTZ,
                consumed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user_active ON password_reset_codes(user_id, consumed_at, expires_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS password_reset_security_actions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reset_code_id UUID NOT NULL REFERENCES password_reset_codes(id) ON DELETE CASCADE,
                action TEXT NOT NULL CHECK (action IN ('lock_account', 'reset_password')),
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                consumed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE INDEX IF NOT EXISTS idx_password_reset_security_actions_user_active
            ON password_reset_security_actions(user_id, action, expires_at DESC)
            WHERE consumed_at IS NULL
        `)
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_locked_at TIMESTAMPTZ')
}
