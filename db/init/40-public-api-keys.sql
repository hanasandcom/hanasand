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
);

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
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_created_at ON api_keys(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_created_at ON api_keys(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_key_scopes_key_route ON api_key_scopes(api_key_id, method, route);
