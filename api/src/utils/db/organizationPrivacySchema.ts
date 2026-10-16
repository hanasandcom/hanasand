import run from '#db'

export default async function ensureOrganizationPrivacySchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS organization_privacy_requests (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion')),
                status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
                requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                request_id TEXT NOT NULL,
                requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
                result JSONB NOT NULL DEFAULT '{}'::jsonb,
                error TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (organization_id, request_type, request_id)
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS organization_retention_runs (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                privacy_request_id TEXT REFERENCES organization_privacy_requests(id) ON DELETE SET NULL,
                trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'privacy_deletion')),
                status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
                retention_days INT NOT NULL CHECK (retention_days BETWEEN 0 AND 2555),
                cutoff_at TIMESTAMPTZ NOT NULL,
                run_date DATE NOT NULL DEFAULT CURRENT_DATE,
                requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                request_id TEXT,
                attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
                selected_count INT NOT NULL DEFAULT 0 CHECK (selected_count >= 0),
                protected_count INT NOT NULL DEFAULT 0 CHECK (protected_count >= 0),
                deleted_count INT NOT NULL DEFAULT 0 CHECK (deleted_count >= 0),
                redacted_count INT NOT NULL DEFAULT 0 CHECK (redacted_count >= 0),
                failed_count INT NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
                started_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ,
                next_retry_at TIMESTAMPTZ,
                error TEXT,
                result JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS organization_retention_run_items (
                run_id TEXT NOT NULL REFERENCES organization_retention_runs(id) ON DELETE CASCADE,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
                source_service TEXT NOT NULL CHECK (source_service IN ('hanasand-api', 'ti-scraper')),
                record_type TEXT NOT NULL,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL CHECK (action IN ('delete', 'redact', 'retain')),
                status TEXT NOT NULL CHECK (status IN ('deleted', 'redacted', 'protected', 'failed')),
                reason TEXT NOT NULL,
                attempt_count INT NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
                error TEXT,
                processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (run_id, source_service, record_type, record_id)
            )
        `)
    await run('ALTER TABLE organization_retention_runs DROP CONSTRAINT IF EXISTS organization_retention_runs_status_check')
    await run('ALTER TABLE organization_retention_runs ADD CONSTRAINT organization_retention_runs_status_check CHECK (status IN (\'queued\', \'running\', \'completed\', \'failed\', \'dead_letter\'))')
    await run('ALTER TABLE organization_retention_runs ADD COLUMN IF NOT EXISTS retried_count INT NOT NULL DEFAULT 0 CHECK (retried_count >= 0)')
    await run('ALTER TABLE organization_retention_run_items DROP CONSTRAINT IF EXISTS organization_retention_run_items_status_check')
    await run('ALTER TABLE organization_retention_run_items ADD CONSTRAINT organization_retention_run_items_status_check CHECK (status IN (\'deleted\', \'redacted\', \'protected\', \'failed\', \'retried\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_privacy_requests_org_updated ON organization_privacy_requests(organization_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_retention_runs_due ON organization_retention_runs(status, next_retry_at, created_at)')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_retention_daily_run ON organization_retention_runs(organization_id, trigger_type, run_date) WHERE trigger_type = \'scheduled\'')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_retention_request_run ON organization_retention_runs(organization_id, trigger_type, request_id) WHERE request_id IS NOT NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_retention_one_active ON organization_retention_runs(organization_id) WHERE status IN (\'queued\', \'running\', \'failed\')')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_retention_items_org_processed ON organization_retention_run_items(organization_id, processed_at DESC)')
    await run(`
            DO $$
            BEGIN
                IF to_regclass('public.admin_audit_events') IS NOT NULL AND to_regclass('public.system_events') IS NULL THEN
                    ALTER TABLE public.admin_audit_events RENAME TO system_events;
                END IF;
                IF to_regclass('public.system_events') IS NOT NULL THEN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_events' AND column_name = 'action_type') THEN
                        ALTER TABLE public.system_events RENAME COLUMN action_type TO event_type;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_events' AND column_name = 'target_type') THEN
                        ALTER TABLE public.system_events RENAME COLUMN target_type TO object_type;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_events' AND column_name = 'target_id') THEN
                        ALTER TABLE public.system_events RENAME COLUMN target_id TO object_id;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_events' AND column_name = 'entity_id') THEN
                        ALTER TABLE public.system_events RENAME COLUMN entity_id TO subject_id;
                    END IF;
                END IF;
            END $$;
        `)
}
