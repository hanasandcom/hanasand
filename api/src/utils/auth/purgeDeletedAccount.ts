import run, { identityQueryOnce, tryWithDatabaseAdvisoryLock, withTransaction } from '#db'
import { accountDeletionOrganizationBlocker, accountDeletionPurgeLockKey, lockAccountDeletionOwnedOrganizations, scrubDeletedUserAuditContext } from './accountDeletion.ts'
import { revokeAllTokens } from './session.ts'
import { deleteMailPrincipal } from '#utils/mail/stalwartAdmin.ts'
import { purgeUserSshKeys } from './purgeUserSshKeys.ts'

type DueAccount = { id: string, name: string, email: string | null }

/**
 * Permanently remove accounts after their restore window. External credentials
 * are revoked before account rows are removed, and failed provider cleanup
 * leaves the account due so the next cron pass can retry it.
 */
export async function purgeDeletedAccount(userId: string) {
    const lock = await tryWithDatabaseAdvisoryLock(accountDeletionPurgeLockKey(userId), () => purgeDeletedAccountWithLock(userId))
    return lock.acquired ? Boolean(lock.result) : false
}

async function purgeDeletedAccountWithLock(userId: string) {
    const account = (await run(`
        SELECT id, name, email
        FROM users
        WHERE id = $1
          AND deletion_scheduled_at <= NOW()
          AND COALESCE(reserved, FALSE) IS FALSE
    `, [userId])).rows[0] as DueAccount | undefined
    if (!account) return false

    const initialBlocker = await accountDeletionOrganizationBlocker(userId)
    if (initialBlocker) return false

    const mailAccount = (await run('SELECT mail_username FROM mail_accounts WHERE user_id = $1', [userId])).rows[0] as { mail_username?: string } | undefined
    await revokeAllTokens({ userId, revokedBy: userId })
    await identityQueryOnce('DELETE FROM tokens WHERE id = $1', [userId])
    await purgeUserSshKeys(userId)
    if (typeof mailAccount?.mail_username === 'string' && mailAccount.mail_username) {
        await deleteMailPrincipal(mailAccount.mail_username)
    }

    return withTransaction(async query => {
        const locked = await query(`
            SELECT id, name, email
            FROM users
            WHERE id = $1
              AND deletion_scheduled_at <= NOW()
              AND COALESCE(reserved, FALSE) IS FALSE
            FOR UPDATE
        `, [userId])
        const target = locked.rows[0] as DueAccount | undefined
        if (!target) return false

        await lockAccountDeletionOwnedOrganizations(userId, query)

        if (await accountDeletionOrganizationBlocker(userId, query)) return false

        await scrubPersonalAccountData(query, userId)
        await scrubUserAuditEvents(query, target)
        await query('DELETE FROM account_deletion_purge_attempts WHERE user_id = $1', [userId])

        const deleted = await query(`
            DELETE FROM users
            WHERE id = $1
              AND deletion_scheduled_at <= NOW()
              AND COALESCE(reserved, FALSE) IS FALSE
            RETURNING id
        `, [userId])
        return deleted.rows.length > 0
    })
}

async function scrubPersonalAccountData(query: typeof run, userId: string) {
    // Article bodies are public product content. Remove only the personal
    // ownership association so deletion does not remove published files.
    await query('DELETE FROM article_ownership WHERE owner_id = $1', [userId])
    // Personal share trees contain private user content. Organization shares
    // are excluded and remain available to their members.
    await query(`
        WITH RECURSIVE personal_tree(id) AS (
            SELECT id
            FROM share
            WHERE organization_id IS NULL AND owner = $1 AND COALESCE(parent, '') = ''
            UNION
            SELECT child.id
            FROM share child
            JOIN personal_tree parent ON child.parent = parent.id
            WHERE child.organization_id IS NULL
        )
        DELETE FROM share
        WHERE organization_id IS NULL
          AND (owner = $1 OR id IN (SELECT id FROM personal_tree))
    `, [userId])
    // Keep organization content available to members while removing personal
    // ownership and integration attribution.
    await query('UPDATE share SET owner = \'\' WHERE organization_id IS NOT NULL AND owner = $1', [userId])
    await query('DELETE FROM case_repositories WHERE owner_id = $1 AND organization_id IS NULL', [userId])
    await query('UPDATE case_repositories SET owner_id = NULL WHERE owner_id = $1 AND organization_id IS NOT NULL', [userId])
    // Personal API keys are credentials. Organization keys remain attached to
    // their organization and lose only the deleted owner's attribution.
    await query('DELETE FROM api_keys WHERE owner_id = $1 AND organization_id IS NULL', [userId])
    await query('UPDATE api_keys SET owner_id = NULL WHERE owner_id = $1 AND organization_id IS NOT NULL', [userId])
    // These identity records intentionally lack foreign keys, so delete them
    // explicitly instead of leaving IP/device history behind.
    await query('DELETE FROM login_events WHERE user_id = $1', [userId])
    await query('DELETE FROM attempts WHERE id = $1', [userId])
}

async function scrubUserAuditEvents(query: typeof run, account: DueAccount) {
    const events = await query(`
        SELECT id, object_type, object_id, context
        FROM system_events
        WHERE actor_id = $1
           OR object_id = $1
           OR subject_id = $1
           OR context->>'targetId' = $1
           OR context->>'target_id' = $1
           OR context->>'userId' = $1
           OR context->>'user_id' = $1
           OR context->>'actorId' = $1
           OR context->>'actor_id' = $1
           OR jsonb_path_exists(context, '$.** ? (@ == $user_id)'::jsonpath, jsonb_build_object('user_id', to_jsonb($1::text)))
           OR ($2::text IS NOT NULL AND jsonb_path_exists(context, '$.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "^(target|actor|user|account)[_-]?(name)$" flag "i" && @.value == $identity)'::jsonpath, jsonb_build_object('identity', to_jsonb($2::text))))
           OR ($3::text IS NOT NULL AND jsonb_path_exists(context, '$.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "^(target|actor|user|account)[_-]?(email)$" flag "i" && @.value == $identity)'::jsonpath, jsonb_build_object('identity', to_jsonb($3::text))))
        ORDER BY id
    `, [account.id, account.name || null, account.email || null])
    const identities = [account.id, account.name, account.email].filter((value): value is string => Boolean(value))
    for (const event of events.rows) {
        await query(`
            UPDATE system_events
            SET object_id = CASE WHEN object_id = $2 THEN NULL ELSE object_id END,
                subject_id = CASE WHEN subject_id = $2 THEN NULL ELSE subject_id END,
                request_id = '',
                ip = '',
                user_agent = '',
                context = $3::jsonb
            WHERE id = $1
        `, [event.id, account.id, JSON.stringify(scrubDeletedUserAuditContext(event.context || {}, identities))])
    }
}
