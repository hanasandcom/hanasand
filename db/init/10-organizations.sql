CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    default_webhook_policy TEXT NOT NULL DEFAULT 'active_destinations' CHECK (default_webhook_policy IN ('active_destinations', 'manual_selection', 'disabled')),
    alert_visibility_policy TEXT NOT NULL DEFAULT 'members' CHECK (alert_visibility_policy IN ('members', 'admins', 'owners')),
    retention_days INT NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 2555),
    audit_safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('owner', 'admin', 'editor', 'reader', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invites (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('admin', 'editor', 'reader', 'member', 'viewer')),
    invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS organization_watchlist_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('company', 'domain', 'vendor', 'actor', 'keyword')),
    value TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    lifecycle_reason TEXT,
    lifecycle_request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id, status, organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org_status ON organization_invites(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organization_watchlist_org_kind ON organization_watchlist_items(organization_id, kind, value) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_watchlist_unique_active ON organization_watchlist_items(organization_id, kind, lower(value)) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS commercial_contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    payload_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    intent TEXT,
    plan TEXT,
    delivery_preference TEXT,
    reply_window TEXT,
    security_review BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT '/contact',
    request_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'closed')),
    notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'notified', 'failed')),
    notification_error TEXT,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_contact_requests_status_created ON commercial_contact_requests(status, created_at DESC);
