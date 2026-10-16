import run from '#db'

export default async function ensureBrowserBillingSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS browser_sandbox_profiles (
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                id TEXT NOT NULL,
                name TEXT NOT NULL,
                tools JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (owner_id, id)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_browser_sandbox_profiles_owner_updated ON browser_sandbox_profiles(owner_id, updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS browser_subscriptions (
                owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'team', 'business', 'volume')),
                active BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS billing_customers (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                stripe_customer_id TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
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
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status ON billing_subscriptions(user_id, status, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer ON billing_subscriptions(stripe_customer_id, updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS billing_entitlements (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                plan_id TEXT NOT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
                features JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, plan_id)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_billing_entitlements_user_active ON billing_entitlements(user_id, active, updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS billing_usage (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                quota_key TEXT NOT NULL,
                period_start TIMESTAMPTZ,
                used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, quota_key, period_start)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_billing_usage_user_key_period ON billing_usage(user_id, quota_key, period_start DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS stripe_webhook_events (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                payload JSONB NOT NULL,
                received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
}
