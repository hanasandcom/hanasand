import run from '#db'
import { ensureColumn, ensureConstraint } from './existingSchema.ts'
import ensureOrganizationRolesSchema from './organizationRolesSchema.ts'
import { ensureOrganizationCreatorReferenceSchema } from './organizationApiKeySchema.ts'

export default async function ensureOrganizationSchema() {
    await run(`
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
            )
        `)
    await ensureColumn(run, 'organizations', 'status', 'ALTER TABLE organizations ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'')
    await ensureColumn(run, 'organizations', 'default_webhook_policy', 'ALTER TABLE organizations ADD COLUMN default_webhook_policy TEXT NOT NULL DEFAULT \'active_destinations\'')
    await ensureColumn(run, 'organizations', 'alert_visibility_policy', 'ALTER TABLE organizations ADD COLUMN alert_visibility_policy TEXT NOT NULL DEFAULT \'members\'')
    await ensureColumn(run, 'organizations', 'retention_days', 'ALTER TABLE organizations ADD COLUMN retention_days INT NOT NULL DEFAULT 365')
    await ensureColumn(run, 'organizations', 'audit_safe_metadata', 'ALTER TABLE organizations ADD COLUMN audit_safe_metadata JSONB NOT NULL DEFAULT \'{}\'::jsonb')
    await ensureOrganizationCreatorReferenceSchema(run)
    await ensureConstraint(run, 'organizations', 'organizations_default_webhook_policy_check', 'CHECK ((default_webhook_policy = ANY (ARRAY[\'active_destinations\'::text, \'manual_selection\'::text, \'disabled\'::text])))',
        'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_default_webhook_policy_check; ALTER TABLE organizations ADD CONSTRAINT organizations_default_webhook_policy_check CHECK (default_webhook_policy IN (\'active_destinations\', \'manual_selection\', \'disabled\'))')
    await ensureConstraint(run, 'organizations', 'organizations_status_check', 'CHECK ((status = ANY (ARRAY[\'active\'::text, \'archived\'::text, \'deleted\'::text])))',
        'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check; SET lock_timeout = \'2s\'; ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN (\'active\', \'archived\', \'deleted\'))')
    await ensureConstraint(run, 'organizations', 'organizations_alert_visibility_policy_check', 'CHECK ((alert_visibility_policy = ANY (ARRAY[\'members\'::text, \'admins\'::text, \'owners\'::text])))',
        'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_alert_visibility_policy_check; ALTER TABLE organizations ADD CONSTRAINT organizations_alert_visibility_policy_check CHECK (alert_visibility_policy IN (\'members\', \'admins\', \'owners\'))')
    await ensureConstraint(run, 'organizations', 'organizations_retention_days_check', 'CHECK (((retention_days >= 30) AND (retention_days <= 2555)))',
        'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_retention_days_check; ALTER TABLE organizations ADD CONSTRAINT organizations_retention_days_check CHECK (retention_days BETWEEN 30 AND 2555)')
    await run(`
            CREATE TABLE IF NOT EXISTS organization_members (
                organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('owner', 'admin', 'editor', 'reader', 'member', 'viewer')),
                status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
                invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (organization_id, user_id)
            )
        `)
    await run(`
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
            )
        `)
    await ensureOrganizationRolesSchema()
    await run('ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ')
    await run('UPDATE organization_members SET removed_at = NOW() WHERE status = \'removed\' AND removed_at IS NULL')
    await run('ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL \'14 days\')')
    await run('ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('ALTER TABLE organization_invites ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ')
    await run('UPDATE organization_invites SET revoked_at = NOW() WHERE status = \'revoked\' AND revoked_at IS NULL')
    await run(`
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
            )
        `)
    await run('ALTER TABLE organization_watchlist_items DROP CONSTRAINT IF EXISTS organization_watchlist_items_kind_check')
    await run('ALTER TABLE organization_watchlist_items ADD CONSTRAINT organization_watchlist_items_kind_check CHECK (kind IN (\'company\', \'domain\', \'vendor\', \'actor\', \'keyword\'))')
    await run('ALTER TABLE organization_watchlist_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT \'active\'')
    await run('ALTER TABLE organization_watchlist_items ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('ALTER TABLE organization_watchlist_items ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT')
    await run('ALTER TABLE organization_watchlist_items ADD COLUMN IF NOT EXISTS lifecycle_request_id TEXT')
    await run('ALTER TABLE organization_watchlist_items DROP CONSTRAINT IF EXISTS organization_watchlist_items_status_check')
    await run('ALTER TABLE organization_watchlist_items ADD CONSTRAINT organization_watchlist_items_status_check CHECK (status IN (\'active\', \'paused\', \'archived\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id, status, organization_id)')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_invites_org_status ON organization_invites(organization_id, status, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_organization_watchlist_org_kind ON organization_watchlist_items(organization_id, kind, value) WHERE archived_at IS NULL')
    await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_watchlist_unique_active ON organization_watchlist_items(organization_id, kind, lower(value)) WHERE archived_at IS NULL')
}
