import run from '#db'

export default async function ensureWebScanSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS web_scan_targets (
                id TEXT PRIMARY KEY,
                target_url TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            INSERT INTO web_scan_targets (id, target_url)
            VALUES ('primary', 'https://hanasand.com')
            ON CONFLICT (id) DO NOTHING
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS web_scan_runs (
                scan_id TEXT PRIMARY KEY,
                target_id TEXT NOT NULL REFERENCES web_scan_targets(id) ON DELETE RESTRICT,
                target_url TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
                target_status TEXT NOT NULL DEFAULT 'pending',
                started_at TIMESTAMPTZ NOT NULL,
                finished_at TIMESTAMPTZ,
                duration_ms INT,
                severity_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
                error TEXT
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_web_scan_runs_started_at ON web_scan_runs(started_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS web_scan_findings (
                id BIGSERIAL PRIMARY KEY,
                scan_id TEXT NOT NULL REFERENCES web_scan_runs(scan_id) ON DELETE CASCADE,
                target_url TEXT NOT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('check', 'port')),
                check_id TEXT NOT NULL,
                status TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                explanation TEXT,
                evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
                port INT,
                elapsed_ms INT,
                UNIQUE(scan_id, check_id)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_web_scan_findings_scan_id ON web_scan_findings(scan_id)')
}
