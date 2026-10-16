import run from '#db'

export default async function ensureAccountDeletionSchema() {
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by TEXT')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_restore_token_hash TEXT')
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_email_token_hash TEXT')
    await run('CREATE SEQUENCE IF NOT EXISTS account_deletion_purge_attempt_order_seq')
    await run(`CREATE TABLE IF NOT EXISTS account_deletion_purge_attempts (
            user_id TEXT PRIMARY KEY,
            attempt_order BIGINT NOT NULL DEFAULT nextval('account_deletion_purge_attempt_order_seq')
        )`)
    await run('ALTER TABLE account_deletion_purge_attempts ADD COLUMN IF NOT EXISTS attempt_order BIGINT')
    await run(`UPDATE account_deletion_purge_attempts
            SET attempt_order = nextval('account_deletion_purge_attempt_order_seq')
            WHERE attempt_order IS NULL`)
    await run(`ALTER TABLE account_deletion_purge_attempts
            ALTER COLUMN attempt_order SET DEFAULT nextval('account_deletion_purge_attempt_order_seq')`)
    await run('ALTER TABLE account_deletion_purge_attempts ALTER COLUMN attempt_order SET NOT NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_account_deletion_purge_attempts_attempt_order ON account_deletion_purge_attempts(attempt_order, user_id)')
}
