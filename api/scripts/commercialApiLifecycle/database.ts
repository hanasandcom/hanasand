import { queryOnce } from '../../src/utils/db.ts'
import ensureCaseDevelopmentSchema from '../../src/utils/db/caseDevelopmentSchema.ts'

export async function resetDatabase() {
    await queryOnce('DROP SCHEMA public CASCADE')
    await queryOnce('CREATE SCHEMA public')
    await queryOnce(`
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        password TEXT NOT NULL,
        avatar TEXT NOT NULL,
        account_type TEXT NOT NULL DEFAULT 'user',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        reserved BOOLEAN NOT NULL DEFAULT FALSE,
        deletion_requested_at TIMESTAMPTZ,
        deletion_scheduled_at TIMESTAMPTZ,
        deletion_restore_token_hash TEXT,
        deletion_email_token_hash TEXT
    );
    CREATE TABLE tokens (
        token_id BIGSERIAL PRIMARY KEY,
        id TEXT NOT NULL,
        token TEXT NOT NULL DEFAULT '',
        ip TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_by TEXT
    );
    CREATE TABLE login_events (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_id INT,
        ip TEXT NOT NULL,
        user_agent TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE attempts (
        id TEXT PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 0,
        ip TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE mail_accounts (
        user_id TEXT PRIMARY KEY,
        mail_username TEXT NOT NULL,
        mail_address TEXT,
        recovery_email TEXT
    );
    CREATE SEQUENCE account_deletion_purge_attempt_order_seq;
    CREATE TABLE account_deletion_purge_attempts (
        user_id TEXT PRIMARY KEY,
        attempt_order BIGINT NOT NULL DEFAULT nextval('account_deletion_purge_attempt_order_seq')
    );
    CREATE TABLE case_repositories (
        id UUID PRIMARY KEY, owner_id TEXT NOT NULL, organization_id TEXT,
        provider TEXT NOT NULL, repository_url TEXT NOT NULL, secret_encrypted TEXT NOT NULL,
        last_received_at TIMESTAMPTZ, last_warning TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX case_repositories_scope_url ON case_repositories (owner_id, COALESCE(organization_id, ''), repository_url);
    CREATE TABLE article_ownership (
        id TEXT PRIMARY KEY,
        owner_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        organization_id TEXT,
        CHECK (num_nonnulls(owner_id, organization_id) = 1)
    );
    CREATE TABLE system_events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        source TEXT NOT NULL DEFAULT 'system',
        service TEXT NOT NULL DEFAULT 'hanasand-api',
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        object_type TEXT,
        object_id TEXT,
        organization_id TEXT,
        subject_id TEXT,
        request_id TEXT,
        outcome TEXT NOT NULL DEFAULT 'success',
        reason TEXT NOT NULL DEFAULT '',
        context JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE api_rate_limit_settings (
        id TEXT PRIMARY KEY,
        config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE api_rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        window_started_at TIMESTAMPTZ NOT NULL,
        request_count INT NOT NULL CHECK (request_count >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_api_rate_limit_buckets_updated_at ON api_rate_limit_buckets(updated_at);
    CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        default_webhook_policy TEXT NOT NULL DEFAULT 'active_destinations',
        alert_visibility_policy TEXT NOT NULL DEFAULT 'members',
        retention_days INT NOT NULL DEFAULT 365,
        audit_safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE organization_members (
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
        invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_at TIMESTAMPTZ,
        PRIMARY KEY (organization_id, user_id)
    );
    CREATE TABLE organization_invites (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
        accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        accepted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        UNIQUE (organization_id, email)
    );
    CREATE TABLE organization_watchlist_items (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        archived_at TIMESTAMPTZ
    );
    CREATE TABLE api_keys (
        id TEXT PRIMARY KEY,
        owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'custom',
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        key_prefix TEXT NOT NULL UNIQUE,
        secret_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX api_keys_one_active_org
        ON api_keys(organization_id)
        WHERE organization_id IS NOT NULL AND enabled IS TRUE;
    CREATE TABLE api_key_scopes (
        id TEXT PRIMARY KEY,
        api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        route TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        per_second INT,
        per_minute INT,
        per_hour INT,
        per_day INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`)
    await ensureCaseDevelopmentSchema()

    async function migrateOrganizationCreatorAttribution() {
        await queryOnce('ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL')
        await queryOnce('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey')
        await queryOnce('ALTER TABLE organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL')
    }

    await migrateOrganizationCreatorAttribution()
    await migrateOrganizationCreatorAttribution()

}
