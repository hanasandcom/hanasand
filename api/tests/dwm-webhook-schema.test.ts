import { afterEach, expect, mock, test } from 'bun:test'

const statements: string[] = []
let failingFragment: string | null = null

mock.module('#db', () => ({
    default: async (sql: string) => {
        statements.push(sql)
        if (failingFragment && sql.includes(failingFragment)) throw new Error('Schema statement failed')
        return { rows: [] }
    },
}))

const { default: ensureDwmWebhookSchema } = await import('../src/utils/db/dwmWebhookSchema.ts')

afterEach(() => {
    statements.length = 0
    failingFragment = null
})

function signature(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim()
    const table = normalized.match(/^CREATE TABLE IF NOT EXISTS (\w+)/)
    if (table) return `CREATE TABLE ${table[1]}`

    const index = normalized.match(/^CREATE INDEX IF NOT EXISTS (\w+)/)
    if (index) return `CREATE INDEX ${index[1]}`

    const alter = normalized.match(
        /^ALTER TABLE (\w+) (ADD COLUMN IF NOT EXISTS \w+|ALTER COLUMN \w+ DROP NOT NULL|DROP CONSTRAINT IF EXISTS \w+|ADD CONSTRAINT \w+)/,
    )
    if (alter) return `ALTER TABLE ${alter[1]} ${alter[2]}`

    throw new Error(`Unrecognized DWM schema statement: ${normalized}`)
}

test('applies DWM webhook schema statements in their established order', async () => {
    await ensureDwmWebhookSchema()

    expect(statements.map(signature)).toEqual([
        'CREATE TABLE dwm_webhook_destinations',
        'ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS endpoint_hash',
        'ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_status',
        'ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_error',
        'ALTER TABLE dwm_webhook_destinations ADD COLUMN IF NOT EXISTS last_test_http_status',
        'CREATE INDEX idx_dwm_webhook_destinations_owner_updated',
        'CREATE INDEX idx_dwm_webhook_destinations_org_status',
        'CREATE INDEX idx_dwm_webhook_destinations_endpoint_hash',
        'CREATE TABLE dwm_webhook_deliveries',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS endpoint_hash',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS payload_hash',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS watchlist_id',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS watchlist_name',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS route',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS case_path',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS error_class',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS attempt_count',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS next_retry_at',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS attempted_at',
        'ALTER TABLE dwm_webhook_deliveries ALTER COLUMN attempted_at DROP NOT NULL',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS completed_at',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS delivered_at',
        'ALTER TABLE dwm_webhook_deliveries ADD COLUMN IF NOT EXISTS updated_at',
        'ALTER TABLE dwm_webhook_deliveries DROP CONSTRAINT IF EXISTS dwm_webhook_deliveries_event_type_check',
        'ALTER TABLE dwm_webhook_deliveries ADD CONSTRAINT dwm_webhook_deliveries_event_type_check',
        'CREATE INDEX idx_dwm_webhook_deliveries_owner_created',
        'CREATE INDEX idx_dwm_webhook_deliveries_org_created',
        'CREATE INDEX idx_dwm_webhook_deliveries_org_updated',
        'CREATE INDEX idx_dwm_webhook_deliveries_destination_created',
        'CREATE INDEX idx_dwm_webhook_deliveries_alert_attempted',
        'CREATE INDEX idx_dwm_webhook_deliveries_payload_hash',
        'CREATE INDEX idx_dwm_webhook_deliveries_next_retry',
        'CREATE TABLE dwm_webhook_audit_events',
        'CREATE INDEX idx_dwm_webhook_audit_owner_created',
        'ALTER TABLE dwm_webhook_audit_events ALTER COLUMN owner_id DROP NOT NULL',
        'ALTER TABLE dwm_webhook_audit_events ALTER COLUMN actor_id DROP NOT NULL',
        'CREATE INDEX idx_dwm_webhook_audit_org_created',
        'CREATE INDEX idx_dwm_webhook_audit_destination_created',
    ])
})

test('stops at the first failed statement and leaves earlier statements applied', async () => {
    failingFragment = 'ADD COLUMN IF NOT EXISTS payload_hash'

    await expect(ensureDwmWebhookSchema()).rejects.toThrow('Schema statement failed')

    expect(statements).toHaveLength(11)
    expect(statements.at(-1)).toContain(failingFragment)
    expect(statements.some((sql) => sql.includes('dwm_webhook_audit_events'))).toBe(false)
})
