import run from '#db'

export default async function ensureDwmWebhookSchema() {
    await run(`
        CREATE TABLE IF NOT EXISTS dwm_webhook_destinations (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_id TEXT NOT NULL,
            name TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'webhook' CHECK (kind IN ('webhook', 'discord')),
            endpoint_encrypted TEXT NOT NULL,
            endpoint_hint TEXT NOT NULL,
            endpoint_hash TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
            events TEXT[] NOT NULL DEFAULT ARRAY['dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed']::TEXT[],
            created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            last_tested_at TIMESTAMPTZ,
            last_test_status TEXT CHECK (last_test_status IN ('dry_run', 'delivered', 'failed', 'skipped')),
            last_test_error TEXT,
            last_test_http_status INT,
            last_delivery_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS endpoint_hash TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_status TEXT')
    await run('ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_error TEXT')
    await run('ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_http_status INT')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_destinations_owner_updated ON dwm_webhook_destinations(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_destinations_org_status ON dwm_webhook_destinations(org_id, status, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_destinations_endpoint_hash ON dwm_webhook_destinations(endpoint_hash)')
    await run(`
        CREATE TABLE IF NOT EXISTS dwm_webhook_deliveries (
            id TEXT PRIMARY KEY,
            destination_id TEXT REFERENCES dwm_webhook_destinations(id) ON DELETE SET NULL,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_id TEXT NOT NULL,
            alert_id TEXT NOT NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('dwm.alert.created', 'dwm.alert.updated', 'dwm.alert.replayed', 'dwm.alert.test')),
            status TEXT NOT NULL CHECK (status IN ('dry_run', 'delivered', 'failed', 'skipped')),
            dry_run BOOLEAN NOT NULL DEFAULT TRUE,
            endpoint_hint TEXT NOT NULL DEFAULT '',
            endpoint_hash TEXT NOT NULL DEFAULT '',
            payload_hash TEXT NOT NULL DEFAULT '',
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            response_status INT,
            response_body TEXT,
            error TEXT,
            error_class TEXT,
            attempt_count INT NOT NULL DEFAULT 1,
            next_retry_at TIMESTAMPTZ,
            idempotency_key TEXT NOT NULL,
            watchlist_id TEXT,
            watchlist_name TEXT,
            route TEXT,
            case_path TEXT,
            attempted_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            delivered_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS endpoint_hash TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS payload_hash TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS watchlist_id TEXT')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS watchlist_name TEXT')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS route TEXT')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS case_path TEXT')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS error_class TEXT')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    await run('ALTER TABLE dwm_webhook_deliveries ALTER COLUMN attempted_at DROP NOT NULL')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ')
    await run('ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    await run('ALTER TABLE dwm_webhook_deliveries DROP CONSTRAINT IF EXISTS dwm_webhook_deliveries_event_type_check')
    await run('ALTER TABLE dwm_webhook_deliveries ADD CONSTRAINT dwm_webhook_deliveries_event_type_check CHECK (event_type IN (\'dwm.alert.created\', \'dwm.alert.updated\', \'dwm.alert.replayed\', \'dwm.alert.test\'))')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_owner_created ON dwm_webhook_deliveries(owner_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_org_created ON dwm_webhook_deliveries(org_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_org_updated ON dwm_webhook_deliveries(org_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_destination_created ON dwm_webhook_deliveries(destination_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_alert_attempted ON dwm_webhook_deliveries(alert_id, attempted_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_payload_hash ON dwm_webhook_deliveries(payload_hash)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_deliveries_next_retry ON dwm_webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL')
    await run(`
        CREATE TABLE IF NOT EXISTS dwm_webhook_audit_events (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            org_id TEXT NOT NULL,
            destination_id TEXT REFERENCES dwm_webhook_destinations(id) ON DELETE SET NULL,
            delivery_id TEXT REFERENCES dwm_webhook_deliveries(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_audit_owner_created ON dwm_webhook_audit_events(owner_id, created_at DESC)')
    await run('ALTER TABLE dwm_webhook_audit_events ALTER COLUMN owner_id DROP NOT NULL')
    await run('ALTER TABLE dwm_webhook_audit_events ALTER COLUMN actor_id DROP NOT NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_audit_org_created ON dwm_webhook_audit_events(org_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_dwm_webhook_audit_destination_created ON dwm_webhook_audit_events(destination_id, created_at DESC)')
}
