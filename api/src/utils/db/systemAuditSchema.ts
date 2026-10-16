import run from '#db'
import { ensureIndex } from './existingSchema.ts'
import ensureAuditAcknowledgmentsSchema from './auditAcknowledgmentsSchema.ts'
import ensureDwmWebhookSchema from './dwmWebhookSchema.ts'

export default async function ensureSystemAuditSchema() {
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_created_at RENAME TO idx_system_events_created_at')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_source_service_created RENAME TO idx_system_events_source_service_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_org_created RENAME TO idx_system_events_org_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_actor_created RENAME TO idx_system_events_actor_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_target_created RENAME TO idx_system_events_object_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_action_created RENAME TO idx_system_events_type_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_entity_created RENAME TO idx_system_events_subject_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_request_created RENAME TO idx_system_events_request_created')
    await run('ALTER INDEX IF EXISTS idx_admin_audit_events_org_actor_created RENAME TO idx_system_events_org_actor_created')
    await run('ALTER TABLE IF EXISTS system_events DROP CONSTRAINT IF EXISTS admin_audit_events_actor_id_fkey')
    await run(`
            CREATE TABLE IF NOT EXISTS system_events (
                id BIGSERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
                source TEXT NOT NULL DEFAULT 'system',
                service TEXT NOT NULL DEFAULT 'hanasand-api',
                actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                object_type TEXT,
                object_id TEXT,
                organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
                subject_id TEXT,
                request_id TEXT,
                outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
                reason TEXT NOT NULL DEFAULT '',
                context JSONB NOT NULL DEFAULT '{}'::jsonb,
                ip TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE system_events ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT \'system\'')
    await run('ALTER TABLE system_events ADD COLUMN IF NOT EXISTS service TEXT NOT NULL DEFAULT \'hanasand-api\'')
    await run('ALTER TABLE system_events ALTER COLUMN actor_id DROP NOT NULL')
    await run('ALTER TABLE system_events DROP CONSTRAINT IF EXISTS system_events_actor_id_fkey')
    await run('ALTER TABLE system_events ADD CONSTRAINT system_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL')
    await ensureAuditAcknowledgmentsSchema()
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_cursor ON system_events(created_at DESC, id DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_outcome_cursor ON system_events(outcome, created_at DESC, id DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_source_service_created ON system_events(source, service, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_org_created ON system_events(organization_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_actor_created ON system_events(actor_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_object_created ON system_events(object_type, object_id, created_at DESC)')
    await ensureIndex(run, 'idx_system_events_org_object_created', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_events_org_object_created ON system_events(organization_id, object_type, object_id, created_at DESC, id DESC)')
    await ensureIndex(run, 'idx_system_events_org_rule_context', 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_events_org_rule_context ON system_events(organization_id, object_type, ((context->>\'ruleId\')), created_at DESC, id DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_type_created ON system_events(event_type, severity, outcome, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_subject_created ON system_events(subject_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_request_created ON system_events(request_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_system_events_org_actor_created ON system_events(organization_id, actor_id, created_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS admin_access_recovery_approvals (
                request_id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                invite_id TEXT NOT NULL REFERENCES organization_invites(id) ON DELETE CASCADE,
                target_user_id TEXT,
                requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                requested_reason TEXT NOT NULL DEFAULT '',
                request_context TEXT NOT NULL DEFAULT '',
                approval_required BOOLEAN NOT NULL DEFAULT TRUE,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'not_required')),
                approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                approved_at TIMESTAMPTZ,
                denied_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                denied_at TIMESTAMPTZ,
                decision_reason TEXT,
                outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_org_status ON admin_access_recovery_approvals(organization_id, status, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_invite ON admin_access_recovery_approvals(invite_id)')
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_requested_by ON admin_access_recovery_approvals(requested_by, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_outcome_updated ON admin_access_recovery_approvals(outcome, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_approved_by ON admin_access_recovery_approvals(approved_by, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_denied_by ON admin_access_recovery_approvals(denied_by, updated_at DESC)')
    await ensureDwmWebhookSchema()
}
