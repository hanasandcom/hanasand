import run from '#db'

export default async function ensureShareSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS share (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                git TEXT,
                locked BOOLEAN NOT NULL DEFAULT FALSE,
                owner TEXT NOT NULL DEFAULT 'anonymous',
                parent TEXT NOT NULL DEFAULT '',
                alias TEXT NOT NULL DEFAULT '',
                type TEXT NOT NULL DEFAULT 'file' CHECK (type IN ('file', 'folder')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_share_owner_updated ON share(owner, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_share_parent ON share(parent)')
    await run('CREATE INDEX IF NOT EXISTS idx_share_alias ON share(alias)')
}
