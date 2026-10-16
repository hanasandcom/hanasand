import run from '#db'
import { ensureColumn } from './existingSchema.ts'
import { ensureTrafficHistorySchema } from '../traffic/history.ts'

export default async function ensureTrafficDesktopSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS traffic_events (
                id BIGSERIAL PRIMARY KEY,
                domain TEXT NOT NULL DEFAULT '',
                path TEXT NOT NULL DEFAULT '',
                method TEXT NOT NULL DEFAULT '',
                status INT NOT NULL DEFAULT 0,
                ip TEXT NOT NULL DEFAULT '',
                country_iso TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT '',
                referer TEXT NOT NULL DEFAULT '',
                request_time_ms INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await ensureColumn(run, 'public.traffic_events', 'country_iso', 'ALTER TABLE traffic_events ADD COLUMN country_iso TEXT NOT NULL DEFAULT \'\'')
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_events_created_at ON traffic_events(created_at DESC)')
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_events_domain_created_at ON traffic_events(domain, created_at DESC)')
    await ensureTrafficHistorySchema()
    await run(`
            CREATE TABLE IF NOT EXISTS desktop_agent_presence (
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                device_id TEXT NOT NULL,
                device_name TEXT NOT NULL DEFAULT 'Mac',
                endpoints TEXT[] NOT NULL DEFAULT '{}'::text[],
                agent_token TEXT NOT NULL DEFAULT '',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (owner_id, device_id)
            )
        `)
    await run('ALTER TABLE desktop_agent_presence ALTER COLUMN agent_token SET DEFAULT \'\'')
    await run('CREATE INDEX IF NOT EXISTS idx_desktop_agent_presence_owner_updated ON desktop_agent_presence(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_desktop_agent_presence_expires ON desktop_agent_presence(expires_at)')
}
