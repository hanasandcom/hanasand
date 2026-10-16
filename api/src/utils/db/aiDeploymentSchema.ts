import run from '#db'
import ensureCaseDevelopmentSchema from './caseDevelopmentSchema.ts'
import ensureMonitoringIssuesSchema from './monitoringIssuesSchema.ts'

export default async function ensureAiDeploymentSchema() {
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS user_agent TEXT')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS expected_down BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS upside_down BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS consecutive_failures INT NOT NULL DEFAULT 0')
    await run('ALTER TABLE agent_automations ADD COLUMN IF NOT EXISTS paused_reason TEXT')
    await run('ALTER TABLE agent_automations DROP CONSTRAINT IF EXISTS agent_automations_action_type_check')
    await run('ALTER TABLE agent_automations ADD CONSTRAINT agent_automations_action_type_check CHECK (action_type IN (\'agent_prompt\', \'echo\', \'mail_health_check\', \'system_alert\', \'organization_report\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automations_owner_updated ON agent_automations(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automations_due ON agent_automations(status, next_run_at)')
    await run(`
            CREATE TABLE IF NOT EXISTS agent_automation_runs (
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
            )
        `)
    await run('ALTER TABLE agent_automation_runs ADD COLUMN IF NOT EXISTS artifacts JSONB NOT NULL DEFAULT \'[]\'::jsonb')
    await run('ALTER TABLE agent_automation_runs ADD COLUMN IF NOT EXISTS warning BOOLEAN NOT NULL DEFAULT FALSE')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_automation_started ON agent_automation_runs(automation_id, started_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_agent_automation_runs_owner_started ON agent_automation_runs(owner_id, started_at DESC)')
    await ensureMonitoringIssuesSchema()
    await ensureCaseDevelopmentSchema()
    await run(`
            CREATE TABLE IF NOT EXISTS ai_deployments (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
                repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL,
                workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
                workspace_id TEXT,
                vm_name TEXT NOT NULL,
                service_name TEXT NOT NULL DEFAULT 'workspace',
                status TEXT NOT NULL CHECK (status IN ('planned', 'syncing', 'building', 'running', 'healthchecking', 'blocked', 'failed')),
                preview_url TEXT,
                healthcheck_url TEXT,
                events JSONB NOT NULL DEFAULT '[]'::jsonb,
                failure_reason TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ
            )
        `)
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS service_name TEXT NOT NULL DEFAULT \'workspace\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS stack_type TEXT NOT NULL DEFAULT \'unknown\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS access_policy TEXT NOT NULL DEFAULT \'owner_only\'')
    await run('ALTER TABLE ai_deployments ADD COLUMN IF NOT EXISTS started_by TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_deployments_owner_updated_at ON ai_deployments(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_deployments_conversation ON ai_deployments(conversation_id, updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS ai_releases (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
                deployment_id TEXT REFERENCES ai_deployments(id) ON DELETE SET NULL,
                vm_name TEXT NOT NULL,
                stack_type TEXT NOT NULL DEFAULT 'unknown',
                access_policy TEXT NOT NULL DEFAULT 'owner_only',
                status TEXT NOT NULL DEFAULT 'current',
                preview_url TEXT,
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                notes TEXT
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_releases_owner_updated_at ON ai_releases(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_releases_conversation ON ai_releases(conversation_id, updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT 'Untitled',
                content TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT 'api',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_notes_owner_updated_at ON notes(owner_id, updated_at DESC, created_at DESC)')
}
