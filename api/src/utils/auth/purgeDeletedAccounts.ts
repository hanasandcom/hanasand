import run, { identityQueryOnce, tryWithDatabaseAdvisoryLock, withTransaction } from '#db'
import { accountDeletionOrganizationBlocker, scrubDeletedUserAuditContext } from './accountDeletion.ts'
import { revokeAllTokens } from './session.ts'
import { deleteMailPrincipal } from '#utils/mail/stalwartAdmin.ts'
import { purgeUserSshKeys } from './purgeUserSshKeys.ts'

export const ACCOUNT_DELETION_PURGE_JOB_ID = 'api-user-account-deletion'
export const ACCOUNT_DELETION_PURGE_BATCH_SIZE = 25

type DueAccount = { id: string, name: string, email: string | null }

/**
 * Permanently remove accounts after their restore window. External credentials
 * are revoked before account rows are removed, and failed provider cleanup
 * leaves the account due so the next cron pass can retry it.
 */
export async function purgeDeletedAccount(userId: string) {
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

        // Article bodies are public product content. Remove only the personal
        // ownership association so deletion does not remove published files.
        await query('DELETE FROM article_ownership WHERE owner_id = $1', [userId])
        // Personal share trees contain private user content. Organization
        // shares are excluded and remain available to their members.
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
        // Organization shares remain accessible to members, but must not
        // retain the deleted account as their recorded owner.
        await query('UPDATE share SET owner = \'\' WHERE organization_id IS NOT NULL AND owner = $1', [userId])
        // Personal webhook integrations are private account data. Keep
        // organization integrations and their case history, but clear the
        // deleted user's attribution because organization access uses members.
        await query('DELETE FROM case_repositories WHERE owner_id = $1 AND organization_id IS NULL', [userId])
        await query('UPDATE case_repositories SET owner_id = \'\' WHERE owner_id = $1 AND organization_id IS NOT NULL', [userId])
        // Personal API keys are credentials. Organization keys remain attached
        // to their organization and lose only the deleted owner's attribution.
        await query('DELETE FROM api_keys WHERE owner_id = $1 AND organization_id IS NULL', [userId])
        // These identity records intentionally lack foreign keys, so delete
        // them explicitly instead of leaving IP/device history behind.
        await query('DELETE FROM login_events WHERE user_id = $1', [userId])
        await query('DELETE FROM attempts WHERE id = $1', [userId])
        await scrubUserAuditEvents(query, target)

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
            SELECT user_account.id
            FROM users user_account
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
            ORDER BY user_account.deletion_scheduled_at, user_account.id
            LIMIT $1
        `, [ACCOUNT_DELETION_PURGE_BATCH_SIZE])

        let purged = 0
        let failed = 0
        for (const row of due.rows as Array<{ id: string }>) {
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

async function scrubUserAuditEvents(query: typeof run, account: DueAccount) {
    const events = await query(`
        SELECT id, object_type, object_id, context
        FROM system_events
        WHERE actor_id = $1
           OR object_id = $1
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
                context = $3::jsonb
            WHERE id = $1
        `, [event.id, account.id, JSON.stringify(scrubDeletedUserAuditContext(event.context || {}, identities))])
    }
}

export default purgeDeletedAccounts
