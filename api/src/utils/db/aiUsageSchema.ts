import run from '#db'

export default async function ensureAiUsageSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS ai_usage_events (
                id BIGSERIAL PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
                repository_id TEXT REFERENCES ai_imported_repositories(id) ON DELETE SET NULL,
                deployment_id TEXT REFERENCES ai_deployments(id) ON DELETE SET NULL,
                release_id TEXT REFERENCES ai_releases(id) ON DELETE SET NULL,
                workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
                workspace_id TEXT,
                kind TEXT NOT NULL CHECK (kind IN (
                    'conversation_created',
                    'message_written',
                    'ai_run_completed',
                    'ai_run_failed',
                    'ai_run_platform_error',
                    'browser_proof_completed',
                    'build_minutes_recorded',
                    'deploy_minutes_recorded',
                    'cache_hit',
                    'deployment_started',
                    'release_recorded',
                    'rollback_marked',
                    'collaborator_invited',
                    'collaborator_removed'
                )),
                units INT NOT NULL DEFAULT 1,
                billable_units INT NOT NULL DEFAULT 1,
                estimated_cost_nok NUMERIC(12,4) NOT NULL DEFAULT 0,
                billing_mode TEXT NOT NULL DEFAULT 'standard',
                outcome TEXT NOT NULL DEFAULT 'unverified',
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_kind_check')
    await run(`
            ALTER TABLE ai_usage_events
            ADD CONSTRAINT ai_usage_events_kind_check CHECK (kind IN (
                'conversation_created',
                'message_written',
                'ai_run_completed',
                'ai_run_failed',
                'ai_run_platform_error',
                'browser_proof_completed',
                'build_minutes_recorded',
                'deploy_minutes_recorded',
                'cache_hit',
                'deployment_started',
                'release_recorded',
                'rollback_marked',
                'collaborator_invited',
                'collaborator_removed'
            ))
        `)
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS billable_units INT NOT NULL DEFAULT 1')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS estimated_cost_nok NUMERIC(12,4) NOT NULL DEFAULT 0')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT \'standard\'')
    await run('ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT \'unverified\'')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_created_at ON ai_usage_events(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_conversation_created_at ON ai_usage_events(conversation_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_kind_created ON ai_usage_events(owner_id, kind, created_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS ai_verification_jobs (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                workspace_kind TEXT,
                workspace_id TEXT,
                kind TEXT NOT NULL CHECK (kind IN ('browser', 'build', 'deploy', 'design')),
                status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
                priority INT NOT NULL DEFAULT 0,
                lane TEXT NOT NULL DEFAULT 'standard',
                queue_position INT NOT NULL DEFAULT 0,
                retry_count INT NOT NULL DEFAULT 0,
                max_retries INT NOT NULL DEFAULT 1,
                current_step TEXT NOT NULL DEFAULT 'Queued',
                target_url TEXT,
                deploy_url TEXT,
                request_id TEXT NOT NULL,
                artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                cancelled_at TIMESTAMPTZ
            )
        `)
    await run('ALTER TABLE ai_verification_jobs DROP CONSTRAINT IF EXISTS ai_verification_jobs_kind_check')
    await run('ALTER TABLE ai_verification_jobs ADD CONSTRAINT ai_verification_jobs_kind_check CHECK (kind IN (\'browser\', \'build\', \'deploy\', \'design\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_owner_created ON ai_verification_jobs(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_workspace_created ON ai_verification_jobs(owner_id, workspace_kind, workspace_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_verification_jobs_queue ON ai_verification_jobs(status, priority DESC, created_at ASC)')
}
