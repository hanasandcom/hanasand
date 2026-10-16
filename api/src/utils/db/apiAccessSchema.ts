import run from '#db'
import ensurePushMonitoringSchema from './pushMonitoringSchema.ts'
import { ensureOrganizationApiKeyOwnerSchema } from './organizationApiKeySchema.ts'

export default async function ensureApiAccessSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS api_rate_limit_settings (
                id TEXT PRIMARY KEY,
                config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
                bucket_key TEXT PRIMARY KEY,
                window_started_at TIMESTAMPTZ NOT NULL,
                request_count INT NOT NULL CHECK (request_count >= 0),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_updated_at ON api_rate_limit_buckets(updated_at)')
    await run(`
            CREATE TABLE IF NOT EXISTS api_keys (
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
            )
        `)
    await run('ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE')
    await ensureOrganizationApiKeyOwnerSchema(run)
    await run(`
            CREATE TABLE IF NOT EXISTS api_key_scopes (
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
    await run('CREATE INDEX IF NOT EXISTS idx_api_keys_owner_created_at ON api_keys(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_api_keys_organization_created_at ON api_keys(organization_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)')
    await run('CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key_route ON api_key_scopes(api_key_id, method, route)')
    await ensurePushMonitoringSchema()
}
