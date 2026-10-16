import run from '#db'

export default async function ensureLoadTestSchema() {
    await run('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await run('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS quota_identity TEXT')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS quota_plan TEXT NOT NULL DEFAULT \'free\'')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS queue_position INT NOT NULL DEFAULT 0')
    await run('ALTER TABLE load_tests ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_created_at ON load_tests(created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_owner_created_at ON load_tests(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_quota_identity_created_at ON load_tests(quota_identity, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_tests_queue ON load_tests(status, queue_position, created_at)')
    await run(`
            CREATE TABLE IF NOT EXISTS load_test_subscriptions (
                owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'team', 'volume')),
                active BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
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
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_load_test_runs_test_started_at ON load_test_runs(test_id, started_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_load_test_runs_url_started_at ON load_test_runs(url, started_at DESC)')
}
