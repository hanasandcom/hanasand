import run, { queryOnce } from '#db'
import { ensureColumn, ensureRuleSourceConstraint } from './existingSchema.ts'
import ensureLogAnalyzeSchema from './logAnalyzeSchema.ts'
import ensureRuleReprocessSchema from './ruleReprocessSchema.ts'
import ensureRuleHitCountSchema from './ruleHitCountSchema.ts'
import ensureLegacyHealthRuleHitMigration from './legacyHealthRuleHitMigration.ts'

export default async function ensureRulesFindingsSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS rules (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                rule_id TEXT NOT NULL,
                version TEXT NOT NULL DEFAULT '1',
                name TEXT NOT NULL,
                family TEXT NOT NULL DEFAULT 'Custom',
                severity TEXT NOT NULL DEFAULT 'medium',
                explanation TEXT NOT NULL,
                definition JSONB NOT NULL DEFAULT '{}'::jsonb,
                source TEXT NOT NULL DEFAULT 'owned',
                source_reference TEXT,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (organization_id, rule_id),
                CHECK (severity IN ('low', 'medium', 'high', 'critical'))
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS rule_storage_estimates (
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                rule_id TEXT NOT NULL,
                rule_version TEXT NOT NULL,
                scanned_date DATE NOT NULL,
                event_count BIGINT NOT NULL DEFAULT 0,
                estimated_bytes BIGINT NOT NULL DEFAULT 0,
                generated_at TIMESTAMPTZ,
                scan_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                scan_finished_at TIMESTAMPTZ,
                PRIMARY KEY (organization_id, rule_id, rule_version)
            )
        `)
    await ensureColumn(run, 'rule_storage_estimates', 'scan_finished_at', 'ALTER TABLE rule_storage_estimates ADD COLUMN IF NOT EXISTS scan_finished_at TIMESTAMPTZ')
    await ensureColumn(run, 'rules', 'source', 'ALTER TABLE rules ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT \'owned\'')
    await ensureColumn(run, 'rules', 'source_reference', 'ALTER TABLE rules ADD COLUMN IF NOT EXISTS source_reference TEXT')
    await ensureRuleSourceConstraint(run)
    const rulesIndexExists = (await queryOnce(`SELECT EXISTS (
            SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='idx_rules_org_enabled' AND relkind='i'
        ) AS present`)).rows[0]?.present
    if (!rulesIndexExists) await run('CREATE INDEX idx_rules_org_enabled ON rules(organization_id, enabled, updated_at DESC)')
    await ensureLogAnalyzeSchema()
    const legacyEventKey = (await queryOnce(`SELECT
            EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='idx_events_log_key' AND relkind='i') AS legacy_index_exists,
            EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.events'::regclass AND attname='log_key' AND attnum > 0 AND NOT attisdropped) AS legacy_column_exists`)).rows[0]
    if (legacyEventKey?.legacy_index_exists) await run('DROP INDEX CONCURRENTLY IF EXISTS idx_events_log_key')
    if (legacyEventKey?.legacy_column_exists) await run('ALTER TABLE events DROP COLUMN log_key')
    await ensureRuleReprocessSchema()
    await run(`
            CREATE TABLE IF NOT EXISTS findings (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                finding_key TEXT NOT NULL UNIQUE,
                rule_id TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'benign', 'resolved', 'suppressed')),
                summary TEXT NOT NULL,
                evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
                event_ids TEXT[] NOT NULL DEFAULT '{}',
                first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                analyst_note TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await ensureColumn(run, 'findings', 'case_id', 'ALTER TABLE findings ADD COLUMN case_id TEXT')
    await ensureColumn(run, 'findings', 'case_delivery_attempted_at', 'ALTER TABLE findings ADD COLUMN case_delivery_attempted_at TIMESTAMPTZ')
    await run('CREATE INDEX IF NOT EXISTS idx_pending_cases ON findings(case_delivery_attempted_at, created_at) WHERE case_id IS NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_findings_org_status ON findings(organization_id, status, last_observed DESC)')
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_findings_org_rule ON findings(organization_id, rule_id)')
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_analyze_receipts_org_rule ON log_analyze_receipts(organization_id, rule_id)')
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log_analyze_receipts_org_rule_created ON log_analyze_receipts(organization_id, rule_id, created_at)')
    await run('CREATE INDEX IF NOT EXISTS idx_findings_event_ids ON findings USING GIN(event_ids)')
    await ensureRuleHitCountSchema()
    await ensureLegacyHealthRuleHitMigration()
    for (const indexName of [
        'idx_logs_phrase_trgm', 'idx_logs_phrase_trgm_ram320', 'idx_logs_service_time',
        'idx_logs_realtime_page_time', 'idx_events_log_http_error_summary', 'idx_events_ssh_key_usage',
        'idx_events_native_pending', 'idx_events_logs_skipped',
        'idx_events_org_time', 'idx_events_org_user_time', 'idx_auth_failure_source_time', 'idx_logs_severity_time', 'idx_logs_type_time',
        'idx_logs_executable_suffix', 'idx_log_dimensions_time', 'idx_log_dimensions_service_time',
    ]) await run(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`)
    await run('DROP STATISTICS IF EXISTS stat_logs_executable_suffix')
}
