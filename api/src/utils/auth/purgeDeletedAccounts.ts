import run, { tryWithDatabaseAdvisoryLock } from '#db'
import { ACCOUNT_DELETION_PURGE_JOB_ID } from './accountDeletion.ts'
import { purgeDeletedAccount } from './purgeDeletedAccount.ts'

export { ACCOUNT_DELETION_PURGE_JOB_ID, purgeDeletedAccount }
export const ACCOUNT_DELETION_PURGE_BATCH_SIZE = 25
const ACCOUNT_DELETION_PURGE_RETRY_BATCH_SIZE = Math.floor(ACCOUNT_DELETION_PURGE_BATCH_SIZE / 2)
const ACCOUNT_DELETION_PURGE_FRESH_BATCH_SIZE = ACCOUNT_DELETION_PURGE_BATCH_SIZE - ACCOUNT_DELETION_PURGE_RETRY_BATCH_SIZE

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

export default purgeDeletedAccounts
