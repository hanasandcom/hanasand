import { isIP } from 'node:net'
import { identityQueryOnce } from '#db'
import { normalizeHostPublicKey } from './hostSsh.ts'
import { invalidateProfileSshKeysResponseCache } from './profileSshKeyCache.ts'
import { cachedRead, invalidateReadCache } from './readCache.ts'

const KEY_INDEX_CACHE_KEY = 'profile-ssh-key-usage-index:identity'
const KEY_INDEX_CACHE_TTL_MS = 30_000
const managedServers = new Map([
    ['inspur', 'inspur'],
    ['hanasand', 'hanasand'],
    ['ovh', 'ovh'],
    ['ovhcloud', 'ovh'],
])

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null }
export type IdentityQuery = (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<QueryResult>

type SshKeyUsageEvent = {
    event_type?: unknown
    action?: unknown
    outcome?: unknown
    timestamp?: unknown
    host?: unknown
    service?: unknown
    message?: unknown
    source?: unknown
    metadata?: unknown
}

type AssignedKey = { user_id: string, key_id: number, public_key: string, username: string }
type UsageRecord = {
    user_id: string
    key_id: number
    server_app: string
    user_agent: string | null
    ip_address: string | null
    last_used_at: string
}

export async function recordProfileSshKeyUsageFromEvents(events: SshKeyUsageEvent[], query: IdentityQuery = identityQueryOnce) {
    const accepted = events.flatMap(event => {
        if (event.event_type !== 'authentication' || event.action !== 'login' || event.outcome !== 'success') return []
        const message = typeof event.message === 'string' ? event.message : ''
        const match = /^Accepted publickey for (?:invalid user )?(\S+) from (\S+) port \d+ ssh2: \S+ (SHA256:[A-Za-z0-9+/]{43})$/.exec(message)
        const serverApp = sshServerApp(event.host, event.service)
        const parsedTimestamp = typeof event.timestamp === 'string' || event.timestamp instanceof Date ? new Date(event.timestamp) : null
        const timestamp = parsedTimestamp && Number.isFinite(parsedTimestamp.getTime()) ? parsedTimestamp.toISOString() : ''
        if (!match || !serverApp || !timestamp) return []
        const source = asObject(event.source)
        const ip = typeof source.ip === 'string' && isIP(source.ip) ? source.ip : isIP(match[2]) ? match[2] : null
        const metadata = asObject(event.metadata)
        const structured = asObject(metadata.structured)
        const request = asObject(structured.req || metadata.request)
        const headers = asObject(request.headers)
        const rawAgent = metadata.user_agent || headers['user-agent']
        const userAgent = typeof rawAgent === 'string' ? rawAgent.slice(0, 512) || null : null
        return [{ username: match[1], fingerprint: match[3], serverApp, userAgent, ip, timestamp }]
    })
    if (!accepted.length) return 0

    const keys = query === identityQueryOnce
        ? await cachedRead(KEY_INDEX_CACHE_KEY, KEY_INDEX_CACHE_TTL_MS, () => loadAssignedKeys(query))
        : await loadAssignedKeys(query)
    const byFingerprint = new Map<string, AssignedKey[]>()
    for (const key of keys) {
        const normalized = normalizeHostPublicKey(key.public_key)
        if (!normalized) continue
        const owners = byFingerprint.get(normalized.fingerprint) || []
        owners.push(key)
        byFingerprint.set(normalized.fingerprint, owners)
    }

    const latest = new Map<string, UsageRecord>()
    for (const event of accepted) {
        const owners = byFingerprint.get(event.fingerprint) || []
        const matchingUsers = owners.filter(key => key.user_id.toLowerCase() === event.username.toLowerCase()
            || key.username.toLowerCase() === event.username.toLowerCase())
        const selected = matchingUsers.length ? matchingUsers : owners.length === 1 ? owners : []
        for (const key of selected) {
            const record: UsageRecord = {
                user_id: key.user_id,
                key_id: key.key_id,
                server_app: event.serverApp,
                user_agent: event.userAgent,
                ip_address: event.ip,
                last_used_at: event.timestamp,
            }
            const recordKey = `${record.user_id}\0${record.key_id}\0${record.server_app}`
            if (!latest.has(recordKey) || Date.parse(latest.get(recordKey)!.last_used_at) < Date.parse(record.last_used_at)) latest.set(recordKey, record)
        }
    }
    if (!latest.size) return 0

    const records = [...latest.values()]
    await query(`
        INSERT INTO ssh_key_usage_latest (user_id, key_id, server_app, user_agent, ip_address, last_used_at)
        SELECT user_id, key_id, server_app, user_agent, ip_address::inet, last_used_at::timestamptz
        FROM jsonb_to_recordset($1::jsonb) AS usage(
            user_id text, key_id bigint, server_app text, user_agent text, ip_address text, last_used_at text
        )
        ON CONFLICT (user_id, key_id, server_app) DO UPDATE
        SET user_agent = CASE WHEN EXCLUDED.last_used_at >= ssh_key_usage_latest.last_used_at THEN EXCLUDED.user_agent ELSE ssh_key_usage_latest.user_agent END,
            ip_address = CASE WHEN EXCLUDED.last_used_at >= ssh_key_usage_latest.last_used_at THEN EXCLUDED.ip_address ELSE ssh_key_usage_latest.ip_address END,
            last_used_at = GREATEST(ssh_key_usage_latest.last_used_at, EXCLUDED.last_used_at)
    `, [JSON.stringify(records)])
    for (const userId of new Set(records.map(record => record.user_id))) invalidateProfileSshKeysResponseCache(userId)
    return records.length
}

export function invalidateProfileSshKeyUsageIndex() {
    invalidateReadCache(KEY_INDEX_CACHE_KEY)
}

async function loadAssignedKeys(query: IdentityQuery): Promise<AssignedKey[]> {
    const result = await query(`
        SELECT uc.user_id, c.id AS key_id, c.public_key,
               COALESCE(NULLIF(u.username, ''), u.id) AS username
        FROM certificates c
        JOIN user_certificates uc ON uc.certificate_id = c.id
        JOIN users u ON u.id = uc.user_id
        WHERE u.active IS TRUE AND u.deletion_scheduled_at IS NULL
    `)
    return result.rows as AssignedKey[]
}

function sshServerApp(hostValue: unknown, serviceValue: unknown) {
    const service = typeof serviceValue === 'string' ? serviceValue.toLowerCase() : ''
    const host = typeof hostValue === 'string' ? hostValue.toLowerCase().replace(/\.$/, '').split('.')[0] : ''
    const server = managedServers.get(host)
    return service === 'sshd' && server ? `${server}/sshd` : null
}

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
