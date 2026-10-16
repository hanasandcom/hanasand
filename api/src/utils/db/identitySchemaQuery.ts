import { pool } from './runtimePools.ts'
import { identityDataTables } from './identityDataTables.ts'

let identityDataDetachedState: Promise<boolean> | undefined

const identityDataTableNames = new Set<string>(identityDataTables)

const identityDataTablePattern = identityDataTables.join('|')

export function markIdentityDataDetached() {
    identityDataDetachedState = Promise.resolve(true)
}

export async function normalizeIdentitySchemaQuery(query: string) {
    const referencesIdentity = new RegExp(`\\bREFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\(`, 'i').test(query)
    const identityDdl = isIdentityTableDdl(query)
    if (!referencesIdentity && !identityDdl) return query
    if (!await identityDataIsDetached()) return query

    if (identityDdl || /^\s*ALTER\s+TABLE\b[\s\S]*\bADD\s+CONSTRAINT\b[\s\S]*\bFOREIGN\s+KEY\b/i.test(query)) return null
    return query
        .replace(new RegExp(`\\s+REFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\([^)]*\\)(?:\\s+ON\\s+DELETE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?(?:\\s+ON\\s+UPDATE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?`, 'gi'), '')
        .replace(new RegExp(`(?:CONSTRAINT\\s+[a-z0-9_]+\\s+)?FOREIGN\\s+KEY\\s*\\([^)]*\\)\\s*REFERENCES\\s+(?:public\\.)?(?:${identityDataTablePattern})\\s*\\([^)]*\\)(?:\\s+ON\\s+(?:DELETE|UPDATE)\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))*\\s*,?`, 'gi'), '')
}

function isIdentityTableDdl(query: string) {
    const table = query.match(/^\s*(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:UNLOGGED\s+)?(?:TABLE|VIEW|FOREIGN\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?|DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?)(?:public\.)?["']?([a-z0-9_]+)/i)
    if (table && identityDataTableNames.has(table[1].toLowerCase())) return true

    const index = query.match(/^\s*(?:CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[a-z0-9_]+\s+ON\s+(?:public\.)?|ALTER\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:public\.)?)([a-z0-9_]+)/i)
    if (index && identityDataTableNames.has(index[1].toLowerCase())) return true
    if (/^\s*(?:ALTER|DROP)\s+INDEX\b/i.test(query) && /\b(?:idx_system_events|idx_admin_access_recovery|idx_organization_(?:watchlist|privacy|retention)|idx_(?:users|login_events|api_keys|api_key_scopes|certificates|user_certificates|host_ssh_keys|impersonation|passkey|password_reset|signup_verification|mail_accounts)[a-z0-9_]*)\b/i.test(query)) return true

    // The legacy audit and impersonation renames are wrapped in DO blocks.
    return /^\s*DO\b/i.test(query)
        && new RegExp(`\\b(?:ALTER|CREATE|DROP)\\s+(?:TABLE|INDEX)\\b[\\s\\S]*?\\b(?:${identityDataTablePattern})\\b`, 'i').test(query)
}

async function identityDataIsDetached() {
    return identityDataDetachedState ||= pool.query(`
        SELECT (to_regclass('public.identity_data_boundary') IS NOT NULL)
            AND EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.users') AND relkind = 'v') AS ready
    `).then(result => result.rows[0]?.ready === true)
}
