import run from '#db'
import { logsOutboxEnabled } from './logOutboxConfig.ts'

type Query = typeof run

export async function ensureLogsOutboxSchema(query: Query = run) {
    if (!logsOutboxEnabled()) return
    await query(`CREATE TABLE IF NOT EXISTS log_organization_sync_outbox (
        organization_id TEXT PRIMARY KEY,
        source_updated_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lease_until TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        last_error TEXT
    )`)
    await query(`CREATE INDEX IF NOT EXISTS idx_log_organization_sync_pending
        ON log_organization_sync_outbox(available_at, organization_id) WHERE delivered_at IS NULL`)
    await query(`CREATE TABLE IF NOT EXISTS log_organization_sync_cursor (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        organization_id TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await query(`CREATE TABLE IF NOT EXISTS log_delivery_outbox (
        id BIGSERIAL PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lease_until TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await query(`CREATE INDEX IF NOT EXISTS idx_log_delivery_pending
        ON log_delivery_outbox(available_at, id) WHERE delivered_at IS NULL`)
}
