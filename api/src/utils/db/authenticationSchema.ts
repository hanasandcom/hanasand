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
}
