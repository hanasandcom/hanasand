import run from '#db'
import { browserResultId } from '../ws/browserResultIdentity.ts'

export default async function ensureBrowserRunSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS browser_runs (
                id TEXT PRIMARY KEY,
                owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                quota_identity TEXT NOT NULL,
                quota_plan TEXT NOT NULL DEFAULT 'anonymous',
                client_id_hash TEXT,
                target TEXT NOT NULL,
                network TEXT NOT NULL CHECK (network IN ('regular', 'tor')),
                status TEXT NOT NULL DEFAULT 'running',
                title TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb
            )
        `)
    await run('ALTER TABLE browser_runs ADD COLUMN IF NOT EXISTS result_id UUID')
    const browserTargets = await run('SELECT DISTINCT target FROM browser_runs WHERE result_id IS NULL')
    for (const { target } of browserTargets.rows) {
        await run('UPDATE browser_runs SET result_id = $1 WHERE target = $2 AND result_id IS NULL', [browserResultId(target), target])
    }
    await run('CREATE INDEX IF NOT EXISTS idx_browser_runs_result_created ON browser_runs(result_id, created_at DESC)')
    await run(`CREATE TABLE IF NOT EXISTS browser_run_evidence (
            id BIGSERIAL PRIMARY KEY,
            run_id TEXT NOT NULL REFERENCES browser_runs(id),
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`)
    await run('CREATE INDEX IF NOT EXISTS idx_browser_run_evidence_run ON browser_run_evidence(run_id, id)')
    await run('CREATE INDEX IF NOT EXISTS idx_browser_runs_owner_created ON browser_runs(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_browser_runs_quota_created ON browser_runs(quota_identity, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_browser_runs_client_created ON browser_runs(client_id_hash, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_browser_runs_created_at ON browser_runs(created_at DESC)')
}
