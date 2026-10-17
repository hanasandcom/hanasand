import { identityQueryOnce } from '#db'
import { normalizeHostPublicKey } from '#utils/hostSsh.ts'

export type ProfileSshKey = {
    id: number
    name: string
    public_key: string
    added_at: string | Date
    last_used_at: string | Date | null
    last_used_server_app: string | null
    last_used_ip_address: string | null
    last_used_user_agent: string | null
}

export const PROFILE_SSH_KEY_CACHE_TTL_MS = 60 * 1000

export async function profileKeys(userId: string) {
    const result = await identityQueryOnce(`
        SELECT c.id, c.name, c.public_key, uc.assigned_at AS added_at,
               latest_use.last_used_at,
               latest_use.server_app AS last_used_server_app,
               latest_use.ip_address AS last_used_ip_address,
               latest_use.user_agent AS last_used_user_agent
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        LEFT JOIN LATERAL (
            SELECT key_use.last_used_at, key_use.server_app, key_use.ip_address::text AS ip_address, key_use.user_agent
            FROM ssh_key_usage_latest key_use
            WHERE key_use.user_id = uc.user_id AND key_use.key_id = c.id
            ORDER BY key_use.last_used_at DESC, key_use.server_app
            LIMIT 1
        ) latest_use ON TRUE
        WHERE uc.user_id = $1
        ORDER BY uc.assigned_at DESC, c.id DESC
    `, [userId])
    return result.rows as ProfileSshKey[]
}

export async function currentHostKeys(exclude?: { userId: string, certificateId: number }) {
    const result = await identityQueryOnce(`
        SELECT DISTINCT c.public_key
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        JOIN users u ON u.id = uc.user_id
        WHERE u.active IS TRUE
          AND u.deletion_scheduled_at IS NULL
          ${exclude ? 'AND NOT (uc.user_id = $1 AND uc.certificate_id = $2)' : ''}
    `, exclude ? [exclude.userId, exclude.certificateId] : [])
    const byFingerprint = new Map<string, string>()
    for (const row of result.rows as Array<{ public_key: string }>) {
        const key = normalizeHostPublicKey(row.public_key)
        if (key) byFingerprint.set(key.fingerprint, key.publicKey)
    }
    return [...byFingerprint.values()]
}

export function responseKey(key: ProfileSshKey) {
    const normalized = normalizeHostPublicKey(key.public_key)
    const addedAt = key.added_at instanceof Date ? key.added_at.toISOString() : key.added_at
    const lastUsedAt = key.last_used_at instanceof Date ? key.last_used_at.toISOString() : key.last_used_at
    return {
        id: key.id,
        name: key.name,
        fingerprint: normalized?.fingerprint || '',
        keyType: normalized?.publicKey.split(' ', 1)[0] || 'SSH key',
        addedAt,
        lastUsedAt,
        lastUsedServer: key.last_used_server_app,
        lastUsedIp: key.last_used_ip_address,
        lastUsedUserAgent: key.last_used_user_agent,
    }
}
