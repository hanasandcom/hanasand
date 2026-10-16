import run, { identityQueryOnce, tryWithDatabaseAdvisoryLock, withTransaction } from '#db'
import { ACCOUNT_DELETION_PURGE_JOB_ID, accountDeletionOrganizationBlocker, accountDeletionPurgeLockKey, scrubDeletedUserAuditContext } from './accountDeletion.ts'
import { revokeAllTokens } from './session.ts'
import { deleteMailPrincipal } from '#utils/mail/stalwartAdmin.ts'
import { purgeUserSshKeys } from './purgeUserSshKeys.ts'

export { ACCOUNT_DELETION_PURGE_JOB_ID }
export const ACCOUNT_DELETION_PURGE_BATCH_SIZE = 25
const ACCOUNT_DELETION_PURGE_RETRY_BATCH_SIZE = Math.floor(ACCOUNT_DELETION_PURGE_BATCH_SIZE / 2)
const ACCOUNT_DELETION_PURGE_FRESH_BATCH_SIZE = ACCOUNT_DELETION_PURGE_BATCH_SIZE - ACCOUNT_DELETION_PURGE_RETRY_BATCH_SIZE

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

        await query(`
            SELECT organization.id
            FROM organizations organization
            JOIN organization_members membership
              ON membership.organization_id = organization.id
             AND membership.user_id = $1
             AND membership.role = 'owner'
             AND membership.status = 'active'
            WHERE organization.status = 'active'
            ORDER BY organization.id
            FOR UPDATE OF organization
        `, [userId])

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

export async function purgeDeletedAccounts() {
    const lock = await tryWithDatabaseAdvisoryLock(ACCOUNT_DELETION_PURGE_JOB_ID, async() => {
        const blocked = await run(`
            SELECT COUNT(DISTINCT user_account.id)::int AS count
            FROM users user_account
            JOIN organization_members membership
              ON membership.user_id = user_account.id
             AND membership.role = 'owner'
             AND membership.status = 'active'
            JOIN organizations organization
              ON organization.id = membership.organization_id
             AND organization.status = 'active'
            WHERE user_account.deletion_scheduled_at <= NOW()
              AND COALESCE(user_account.reserved, FALSE) IS FALSE
              AND NOT EXISTS (
                  SELECT 1
                  FROM organization_members other_membership
                  JOIN users other_owner
                    ON other_owner.id = other_membership.user_id
                   AND other_owner.active IS TRUE
                   AND other_owner.deletion_scheduled_at IS NULL
                  WHERE other_membership.organization_id = organization.id
                    AND other_membership.user_id <> user_account.id
                    AND other_membership.role = 'owner'
                    AND other_membership.status = 'active'
              )
        `)
        const blockedOwnerAccounts = Number(blocked.rows[0]?.count || 0)
        if (blockedOwnerAccounts > 0) {
            console.warn(`${blockedOwnerAccounts} due account deletion(s) are waiting for an organization ownership transfer.`)
        }

        const due = await run(`
            WITH eligible_accounts AS (
                SELECT user_account.id,
                       user_account.deletion_scheduled_at,
                       purge_attempt.user_id IS NOT NULL AS has_attempt,
                       purge_attempt.attempt_order,
                       ROW_NUMBER() OVER (
                           PARTITION BY purge_attempt.user_id IS NOT NULL
                           ORDER BY purge_attempt.attempt_order ASC NULLS FIRST,
                                    user_account.deletion_scheduled_at,
                                    user_account.id
                       ) AS cohort_position
                FROM users user_account
                LEFT JOIN account_deletion_purge_attempts purge_attempt
                  ON purge_attempt.user_id = user_account.id
                WHERE user_account.deletion_scheduled_at <= NOW()
                  AND COALESCE(user_account.reserved, FALSE) IS FALSE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM organizations organization
                      JOIN organization_members membership
                        ON membership.organization_id = organization.id
                       AND membership.user_id = user_account.id
                       AND membership.role = 'owner'
                       AND membership.status = 'active'
                      WHERE organization.status = 'active'
                        AND NOT EXISTS (
                            SELECT 1
                            FROM organization_members other_membership
                            JOIN users other_owner
                              ON other_owner.id = other_membership.user_id
                             AND other_owner.active IS TRUE
                             AND other_owner.deletion_scheduled_at IS NULL
                            WHERE other_membership.organization_id = organization.id
                              AND other_membership.user_id <> user_account.id
                              AND other_membership.role = 'owner'
                              AND other_membership.status = 'active'
                        )
                  )
            ),
            prioritized_accounts AS (
                SELECT id,
                       has_attempt,
                       attempt_order,
                       cohort_position,
                       CASE
                           WHEN has_attempt AND cohort_position <= $2 THEN 0
                           WHEN NOT has_attempt AND cohort_position <= $3 THEN 1
                           ELSE 2
                       END AS batch_group
                FROM eligible_accounts
            )
            SELECT id
            FROM prioritized_accounts
            ORDER BY batch_group,
                     CASE WHEN batch_group = 2 THEN cohort_position END,
                     CASE WHEN batch_group = 2 AND has_attempt THEN 0 ELSE 1 END,
                     cohort_position
            LIMIT $1
        `, [ACCOUNT_DELETION_PURGE_BATCH_SIZE, ACCOUNT_DELETION_PURGE_RETRY_BATCH_SIZE, ACCOUNT_DELETION_PURGE_FRESH_BATCH_SIZE])

        let purged = 0
        let failed = 0
        for (const row of due.rows as Array<{ id: string }>) {
            await run(`
                INSERT INTO account_deletion_purge_attempts (user_id, attempt_order)
                VALUES ($1, nextval('account_deletion_purge_attempt_order_seq'))
                ON CONFLICT (user_id) DO UPDATE
                SET attempt_order = EXCLUDED.attempt_order
            `, [row.id])
            try {
                if (await purgeDeletedAccount(row.id)) purged++
            } catch (error) {
                failed++
                console.error('Account deletion cleanup will retry on the next scheduled pass.', error)
            }
        }
        if (failed > 0) throw new Error(`${failed} due account deletion cleanup(s) failed; the next scheduled pass will retry them.`)
        return { scanned: due.rows.length, purged, failed, blockedOwnerAccounts }
    })

    return lock.acquired ? lock.result : { scanned: 0, purged: 0, failed: 0, blockedOwnerAccounts: 0, skipped: 'already_running' }
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
        ORDER BY id
    `, [account.id])
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

export default purgeDeletedAccounts
