import run from '#db'

export default async function ensureSupportSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id UUID PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subject TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_support_tickets_updated ON support_tickets(updated_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS support_messages (
                id UUID PRIMARY KEY,
                ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
                sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages(ticket_id, created_at ASC)')
    await run(`
            CREATE TABLE IF NOT EXISTS commercial_contact_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_id TEXT NOT NULL UNIQUE,
                idempotency_key TEXT NOT NULL UNIQUE,
                payload_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                company TEXT,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                intent TEXT,
                plan TEXT,
                delivery_preference TEXT,
                reply_window TEXT,
                security_review BOOLEAN NOT NULL DEFAULT FALSE,
                source TEXT NOT NULL DEFAULT '/contact',
                request_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'closed')),
                notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (notification_status IN ('pending', 'notified', 'failed')),
                notification_error TEXT,
                notified_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_commercial_contact_requests_status_created ON commercial_contact_requests(status, created_at DESC)')
}
