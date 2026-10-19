import run from '#db'

export default async function ensureNotesSchema() {
    await run(`CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'api',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run('CREATE INDEX IF NOT EXISTS idx_notes_owner_updated_at ON notes(owner_id, updated_at DESC, created_at DESC)')
}
