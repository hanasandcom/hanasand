-- Root table
CREATE TABLE IF NOT EXISTS root (
    id TEXT PRIMARY KEY,
    created BOOLEAN NOT NULL DEFAULT false
);

-- Load tests table
CREATE TABLE IF NOT EXISTS load_tests (
    id TEXT PRIMARY KEY DEFAULT substring(translate(encode(gen_random_bytes(4), 'base64'), '+/', 'AB') for 6),
    url TEXT NOT NULL,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    quota_identity TEXT,
    quota_plan TEXT NOT NULL DEFAULT 'free',
    timeout INTEGER DEFAULT 1,
    stages JSONB NOT NULL DEFAULT '{"default": true}',
    status TEXT DEFAULT 'pending',
    queue_position INT NOT NULL DEFAULT 0,
    visits INT NOT NULL DEFAULT 0,
    logs TEXT[] DEFAULT '{}',
    errors TEXT[] DEFAULT '{}',
    exit_code INT,
    summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    duration INTERVAL
);

CREATE INDEX IF NOT EXISTS idx_load_tests_created_at ON load_tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_tests_owner_created_at ON load_tests(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_tests_quota_identity_created_at ON load_tests(quota_identity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_tests_queue ON load_tests(status, queue_position, created_at);

CREATE TABLE IF NOT EXISTS load_test_subscriptions (
    owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'team', 'volume')),
    active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_customers (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status ON billing_subscriptions(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer ON billing_subscriptions(stripe_customer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_entitlements (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, plan_id)
);
CREATE INDEX IF NOT EXISTS idx_billing_entitlements_user_active ON billing_entitlements(user_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS billing_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quota_key TEXT NOT NULL,
    period_start TIMESTAMPTZ,
    used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, quota_key, period_start)
);
CREATE INDEX IF NOT EXISTS idx_billing_usage_user_key_period ON billing_usage(user_id, quota_key, period_start DESC);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS load_test_runs (
    id BIGSERIAL PRIMARY KEY,
    test_id TEXT NOT NULL REFERENCES load_tests(id) ON DELETE CASCADE,
    run_number INT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    exit_code INT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    duration_ms INT,
    UNIQUE(test_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_load_test_runs_test_started_at ON load_test_runs(test_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_load_test_runs_url_started_at ON load_test_runs(url, started_at DESC);

CREATE TABLE IF NOT EXISTS api_rate_limit_settings (
    id TEXT PRIMARY KEY,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INT NOT NULL CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_updated_at ON api_rate_limit_buckets(updated_at);
