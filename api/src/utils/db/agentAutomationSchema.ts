import run from '#db'

export default async function ensureAgentAutomationSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS agent_automations (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                prompt TEXT NOT NULL,
                schedule_kind TEXT NOT NULL CHECK (schedule_kind IN ('once', 'interval')),
                interval_minutes INT,
                run_at TIMESTAMPTZ,
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
                event_type TEXT NOT NULL DEFAULT 'agent_prompt' CHECK (event_type IN ('agent_prompt', 'echo', 'mail_health_check', 'system_alert', 'organization_report')),
                organization_id TEXT,
                timezone TEXT NOT NULL DEFAULT 'UTC',
                model_name TEXT,
                notify_on TEXT NOT NULL DEFAULT 'failure' CHECK (notify_on IN ('never', 'failure', 'always')),
                notify_warnings BOOLEAN NOT NULL DEFAULT FALSE,
                notification_destinations TEXT[] NOT NULL DEFAULT '{}',
                monitoring_type TEXT NOT NULL DEFAULT 'fetch',
                follow_redirects BOOLEAN NOT NULL DEFAULT TRUE,
                user_agent TEXT,
                expected_down BOOLEAN NOT NULL DEFAULT FALSE,
                upside_down BOOLEAN NOT NULL DEFAULT FALSE,
                next_run_at TIMESTAMPTZ,
                last_run_at TIMESTAMPTZ,
                last_completed_at TIMESTAMPTZ,
                last_status TEXT,
                last_result TEXT,
                last_error TEXT,
                consecutive_failures INT NOT NULL DEFAULT 0,
                paused_reason TEXT,
                run_count INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS organization_id TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS target_url TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS timeout_seconds INT NOT NULL DEFAULT 5')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 4')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS certificate_status TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS certificate_subject TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS certificate_issuer TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS certificate_expires_at TIMESTAMPTZ')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT \'UTC\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS model_name TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS notify_on TEXT NOT NULL DEFAULT \'failure\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS notify_warnings BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS notification_destinations TEXT[] NOT NULL DEFAULT \'{}\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS monitoring_type TEXT NOT NULL DEFAULT \'fetch\'')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS follow_redirects BOOLEAN NOT NULL DEFAULT TRUE')
    await run(`CREATE TABLE IF NOT EXISTS agent_automation_runs (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL REFERENCES agent_automations(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        warning BOOLEAN NOT NULL DEFAULT FALSE,
        result TEXT,
        error TEXT,
        provider TEXT,
        model TEXT,
        artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        duration_ms INT
    )`)
    await run('ALTER TABLE agent_automation_runs ADD COLUMN IF NOT EXISTS artifacts JSONB NOT NULL DEFAULT \'[]\'::jsonb')
    await run('ALTER TABLE agent_automation_runs ADD COLUMN IF NOT EXISTS warning BOOLEAN NOT NULL DEFAULT FALSE')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_automation_started ON agent_automation_runs(automation_id, started_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_owner_started ON agent_automation_runs(owner_id, started_at DESC)')
}
