import run from '#db'

export default async function ensureLogTuningSchema() {
    await run(`CREATE TABLE IF NOT EXISTS log_tuning_snapshots (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        logs JSONB NOT NULL DEFAULT '[]'::jsonb,
        generated_at TIMESTAMPTZ,
        refresh_requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}
