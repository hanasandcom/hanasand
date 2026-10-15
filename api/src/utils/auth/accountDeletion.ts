import { createHash, randomBytes } from 'crypto'
import run from '#db'

export function createAccountRestoreToken() {
    const token = randomBytes(32).toString('base64url')
    return { token, hash: hashAccountRestoreToken(token) }
}

export function hashAccountRestoreToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

export async function accountDeletionOrganizationBlocker(userId: string, query: typeof run = run) {
    const result = await query(`
        SELECT
            organization.id,
            organization.name,
            EXISTS (
                SELECT 1
                FROM api_keys
                WHERE organization_id = organization.id
                  AND enabled IS TRUE
                  AND (expires_at IS NULL OR expires_at > NOW())
            ) AS active_api_key
        FROM organizations organization
        JOIN organization_members membership
          ON membership.organization_id = organization.id
         AND membership.user_id = $1
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
                AND other_membership.user_id <> $1
                AND other_membership.role = 'owner'
                AND other_membership.status = 'active'
          )
        ORDER BY organization.created_at ASC, organization.id ASC
        LIMIT 1
    `, [userId])
    const row = result.rows[0] as { id?: unknown, name?: unknown, active_api_key?: unknown } | undefined
    if (!row || typeof row.id !== 'string' || typeof row.name !== 'string') return null
    return { kind: 'organization' as const, id: row.id, name: row.name, activeApiKey: row.active_api_key === true }
}

export function scrubDeletedUserAuditContext(value: unknown, identities: string[]): unknown {
    if (typeof value === 'string') return identities.includes(value) ? '[deleted user]' : value
    if (Array.isArray(value)) return value.map(item => scrubDeletedUserAuditContext(item, identities))
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
        const identifiesUser = /^(?:target|actor|user|account)[_-]?(?:id|name|email)$/i.test(key)
            && typeof item === 'string' && identities.includes(item)
        return identifiesUser ? [] : [[key, scrubDeletedUserAuditContext(item, identities)]]
    }))
}
