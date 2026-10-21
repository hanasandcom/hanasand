import run from '#db'
import { ensureColumn } from './existingSchema.ts'
import ensureSharedMailSchema from './sharedMailSchema.ts'

export default async function ensureMailSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS mail_accounts (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                mail_username TEXT NOT NULL UNIQUE,
                mail_address TEXT NOT NULL UNIQUE,
                recovery_email TEXT,
                mail_password_encrypted TEXT NOT NULL,
                principal_id INT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await ensureSharedMailSchema()
    await ensureColumn(run, 'mail_accounts', 'recovery_email', 'ALTER TABLE mail_accounts ADD COLUMN IF NOT EXISTS recovery_email TEXT')
    await run('ALTER TABLE mail_accounts ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ')
    await run(`
            CREATE TABLE IF NOT EXISTS mail_filters (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
                action JSONB NOT NULL DEFAULT '{}'::jsonb,
                priority INT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_filters_user_priority ON mail_filters(user_id, priority ASC, id ASC)')
    await run(`
            CREATE TABLE IF NOT EXISTS mail_recent_recipients (
                owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                mailbox_user TEXT NOT NULL,
                email TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                use_count INT NOT NULL DEFAULT 1,
                last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (owner_user_id, mailbox_user, email)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_recent_recipients_lookup ON mail_recent_recipients(owner_user_id, mailbox_user, last_used_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS mail_reputation_cache (
                resource_hash CHAR(64) NOT NULL,
                resource_type TEXT NOT NULL CHECK (resource_type IN ('url', 'file')),
                status TEXT NOT NULL CHECK (status IN ('known', 'unknown')),
                flagged INT,
                total INT,
                report_url TEXT NOT NULL,
                checked_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (resource_type, resource_hash)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_reputation_expiry ON mail_reputation_cache(expires_at)')
    await run(`
            CREATE TABLE IF NOT EXISTS mail_attachment_hash_cache (
                mailbox_user TEXT NOT NULL,
                blob_id TEXT NOT NULL,
                sha256 CHAR(64) NOT NULL,
                checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (mailbox_user, blob_id)
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS mail_send_idempotency (
                actor_user_id TEXT NOT NULL,
                mailbox_user TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                payload_hash CHAR(64) NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed', 'uncertain')),
                response_status INT,
                response_body JSONB,
                error_message TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (actor_user_id, mailbox_user, idempotency_key)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_mail_send_idempotency_created ON mail_send_idempotency(created_at)')
}
