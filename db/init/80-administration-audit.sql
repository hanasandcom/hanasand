CREATE TABLE IF NOT EXISTS admin_audit_events (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
    source TEXT NOT NULL DEFAULT 'admin',
    service TEXT NOT NULL DEFAULT 'hanasand-api',
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    target_type TEXT,
    target_id TEXT,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT,
    request_id TEXT,
    outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
    reason TEXT NOT NULL DEFAULT '',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at ON admin_audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_source_service_created ON admin_audit_events(source, service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_org_created ON admin_audit_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor_created ON admin_audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_target_created ON admin_audit_events(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_action_created ON admin_audit_events(action_type, severity, outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_entity_created ON admin_audit_events(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_request_created ON admin_audit_events(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_org_actor_created ON admin_audit_events(organization_id, actor_id, created_at DESC);

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
);

CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_org_status ON admin_access_recovery_approvals(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_invite ON admin_access_recovery_approvals(invite_id);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_requested_by ON admin_access_recovery_approvals(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_outcome_updated ON admin_access_recovery_approvals(outcome, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_approved_by ON admin_access_recovery_approvals(approved_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_recovery_denied_by ON admin_access_recovery_approvals(denied_by, updated_at DESC);
