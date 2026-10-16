import run from '#db'

export default async function ensureOperationsMonitoringSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS service_monitor_results (
                id BIGSERIAL PRIMARY KEY,
                service TEXT NOT NULL,
                check_name TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
                latency_ms INT NOT NULL DEFAULT 0,
                message TEXT,
                checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_service_monitor_results_checked_at ON service_monitor_results(checked_at)')
    await run('CREATE INDEX IF NOT EXISTS idx_service_monitor_results_service_check ON service_monitor_results(service, check_name, checked_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_service_monitor_results_non_up ON service_monitor_results(service, check_name, checked_at) WHERE status <> \'up\'')
    await run(`
            CREATE TABLE IF NOT EXISTS host_update_snapshots (
                host TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                status TEXT NOT NULL,
                checked_at TIMESTAMPTZ NOT NULL,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS host_update_events (
                id BIGSERIAL PRIMARY KEY,
                host TEXT NOT NULL,
                run_id TEXT NOT NULL,
                status TEXT NOT NULL,
                occurred_at TIMESTAMPTZ NOT NULL,
                packages JSONB NOT NULL DEFAULT '[]'::jsonb,
                error TEXT,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                UNIQUE(host, run_id)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_host_update_events_host_occurred ON host_update_events(host, occurred_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS scheduled_job_controls (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'paused')),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
}
