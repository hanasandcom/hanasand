import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import pg from 'pg'

const prefix = process.env.WATCHLIST_STAGE_PREFIX || ''
if (!/^ti-native-proof-[a-f0-9]{12}$/.test(prefix) || process.env.WATCHLIST_PROOF_STAGE !== 'synthetic-only'
    || process.env.DB_HOST !== `${prefix}-db` || process.env.DB_USER !== 'synthetic'
    || !['core-only', 'full'].includes(process.env.WATCHLIST_STAGE_MODE || '')) throw Error('Requires isolated full topology')
const org = '.synthetic:core@organization'
const root = `/api/organizations/${encodeURIComponent(org)}/watchlists`
const identity = `http://${prefix}-identity:8081`
const website = `http://${prefix}-website:3000`
const core = `http://${prefix}-core:8082`
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
let assertions = 0
function eq(actual: unknown, expected: unknown) { assertions++; assert.deepEqual(actual, expected) }
function ok(actual: unknown) { assertions++; assert.ok(actual) }
const clients: pg.Client[] = []
async function database(name: string) {
    const client = new pg.Client({ host: `${prefix}-db`, port: 5432, user: 'synthetic', password: 'synthetic-local-only', database: name })
    clients.push(client); await client.connect(); return client
}
function proof(token: string, path: string, direct = false, overrides: { method?: string, target?: string, signer?: typeof key } = {}) {
    const signer = overrides.signer || key
    const header = Buffer.from(JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: signer.publicKey.export({ format: 'jwk' }) })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ htm: overrides.method || 'POST', htu: overrides.target || `https://${direct ? 'api.' : ''}hanasand.com${path}`,
        iat: Math.floor(Date.now() / 1000), jti: randomUUID(), ath: createHash('sha256').update(token).digest('base64url') })).toString('base64url')
    const input = `${header}.${payload}`
    return `${input}.${sign('sha256', Buffer.from(input), { key: signer.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

test('compiled website and native Core: real FDW save, direct audit and explicit projection recovery', { timeout: 60000 }, async () => {
    const source = await database('ti_native_proof_test')
    const api = await database('core_watchlist_proof_test')
    const projection = await database('ti_watchlist_projection_test')
    let auditTrigger = false, lock = false
    try {
        const issued = await fetch(`${identity}/api/auth/internal/sessions`, { method: 'POST', headers: { authorization: 'Bearer synthetic-internal-only', 'content-type': 'application/json' },
            body: JSON.stringify({ operation: 'issue', id: 'synthetic-customer', devicePublicJwk: key.publicKey.export({ format: 'jwk' }) }) })
        eq(issued.status, 200)
        const token = (await issued.json() as { token: string }).token
        ok(typeof token === 'string' && token.length > 20)
        const countProofs = async () => Number((await source.query('SELECT count(*) FROM session_device_proof_jtis')).rows[0].count)
        const sourceRows = async () => (await source.query('SELECT * FROM organization_watchlist_items WHERE organization_id=$1 ORDER BY id', [org])).rows
        const quotas = async () => (await api.query('SELECT * FROM billing_usage ORDER BY user_id,quota_key')).rows
        const call = async (path: string, body: unknown, options: { direct?: boolean, jwt?: string, headers?: Record<string, string> } = {}) => {
            const jwt = options.jwt === undefined ? proof(token, path, options.direct) : options.jwt
            const headers: Record<string, string> = options.direct ? { authorization: `Bearer ${token}`, id: 'synthetic-customer', host: 'api.hanasand.com', 'x-forwarded-proto': 'https',
                'x-device-proof-method': 'POST', 'x-device-proof-url': `https://api.hanasand.com${path}` }
                : { cookie: `id=synthetic-customer; access_token=${token}` }
            const response = await fetch(`${options.direct ? core : website}${path}`, { method: 'POST', headers: {
                ...headers, DPoP: jwt, 'content-type': 'application/json', ...options.headers,
            }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) })
            return { status: response.status, body: await response.json() as Record<string, any> }
        }
        const nativeProofFailures: string[] = []
        const retryProbe = `${root}/reconcile`
        const unrelated = 'https://api.hanasand.com/api/unrelated'
        const wrongKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
        const probes: Array<[string, string, Record<string, string>]> = [
            ['GET_on_POST', proof(token, retryProbe, true, { method: 'GET' }), { 'x-device-proof-method': 'GET' }],
            ['foreign_target', proof(token, retryProbe, true, { target: unrelated }), { 'x-device-proof-url': unrelated }],
            ['forwarded_origin', proof(token, retryProbe, true, { target: `https://foreign.invalid${retryProbe}` }),
                { 'x-forwarded-host': 'foreign.invalid', 'x-forwarded-proto': 'https', 'x-device-proof-url': `https://foreign.invalid${retryProbe}` }],
            ['wrong_key', proof(token, retryProbe, true, { signer: wrongKey }), {}],
            ['missing_proof', '', {}],
        ]
        for (const [name, jwt, headers] of probes) {
            // Missing selected source ID guarantees no mutation/child even if an auth guard fails.
            const result = await call(retryProbe, { itemIds: ['stage-missing-item'] }, { direct: true, jwt, headers })
            console.log(`native_proof_probe=${name} status=${result.status} expected=401`)
            if (result.status !== 401) nativeProofFailures.push(name)
        }
        eq((await sourceRows()).length, 0)
        const beforeQuotas = await quotas()
        const beforeProof = await countProofs()
        await projection.query('BEGIN'); lock = true
        await projection.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`organization-watchlist:${org}`])
        let saved: Awaited<ReturnType<typeof call>>
        try {
            saved = await call(root, { kind: 'domain', value: 'synthetic-watchlist.example', reason: 'Synthetic staged save.', requestId: 'stage-source-create' }, { direct: process.env.WATCHLIST_STAGE_MODE === 'core-only' })
        } finally { await projection.query('ROLLBACK'); lock = false }
        console.log(`fdw_source_create=${JSON.stringify({ status: saved.status, expected: 201, code: saved.body.code || null, message: String(saved.body.message || saved.body.error || '').slice(0, 1000), sourceCount: (await sourceRows()).length, auditCount: Number((await source.query('SELECT count(*) FROM system_events WHERE request_id=$1', ['stage-source-create'])).rows[0].count) })}`)
        eq(saved.status, 201)
        eq(saved.body.saved, true)
        eq(saved.body.dwmAlertBridge.projection.status, 'pending')
        eq(saved.body.dwmAlertBridge.alertRebuild, { status: 'not_requested', reason: 'projection_only' })
        eq(await countProofs(), beforeProof + 1)
        const rows = await sourceRows(); eq(rows.length, 1)
        const itemId = String(saved.body.watchlistItem.id)
        eq(rows[0].id, itemId); eq(rows[0].value, 'synthetic-watchlist.example')
        eq((await projection.query('SELECT count(*) FROM threat_intel.workflow_records')).rows[0].count, '0')
        eq(nativeProofFailures, [])
        if (process.env.WATCHLIST_STAGE_MODE === 'core-only') {
            ok(Number((await source.query('SELECT id FROM system_events WHERE request_id=\'stage-source-create\'')).rows[0]?.id) > 0)
            console.log(`watchlists_core_probe_assertions=${assertions}; actual FDW create and direct Identity audit passed`)
            return
        }
        const sourceSnapshot = JSON.stringify(rows)
        const orgSnapshot = JSON.stringify((await source.query('SELECT updated_at FROM organizations WHERE id=$1', [org])).rows)
        const retryPath = `${root}/reconcile`
        const jwt = proof(token, retryPath)
        const retry = await call(retryPath, { itemIds: [itemId], requestId: 'stage-human-retry' }, { jwt })
        eq(retry.status, 200); eq(retry.body.saved, undefined)
        eq(retry.body.dwmAlertBridge.projection.status, 'synchronized')
        eq(await countProofs(), beforeProof + 2)
        const audit = (await source.query('SELECT * FROM system_events WHERE request_id=\'stage-human-retry\' AND event_type=\'watchlist.projection_retry_requested\'')).rows
        eq(audit.length, 1); ok(Number(audit[0].id) > 0); eq(audit[0].actor_id, 'synthetic-customer')
        eq(audit[0].organization_id, org); eq(audit[0].context.itemIds, [itemId])
        const record = (await projection.query('SELECT record FROM threat_intel.workflow_records WHERE record_type=\'dwm_watchlist\'')).rows[0].record
        eq(record.organizationWatchlistProjection.actor, 'service:ti'); eq(record.terms[0].value, 'synthetic-watchlist.example')
        eq((await call(retryPath, { itemIds: [itemId] }, { jwt })).status, 401)
        eq(await countProofs(), beforeProof + 2)
        const native = await call(retryPath, { itemIds: [itemId], requestId: 'stage-native-retry' }, { direct: true, headers: { 'x-organization-id': org, 'x-tenant-id': org } })
        eq(native.status, 200); eq(native.body.dwmAlertBridge.projection.status, 'unchanged')
        eq(await countProofs(), beforeProof + 3)
        eq(JSON.stringify(await sourceRows()), sourceSnapshot)
        eq(JSON.stringify((await source.query('SELECT updated_at FROM organizations WHERE id=$1', [org])).rows), orgSnapshot)
        eq(await quotas(), beforeQuotas)
        eq((await source.query('SELECT count(*) FROM system_events WHERE request_id=\'stage-source-create\'')).rows[0].count, '1')
        const spoofed: Record<string, string>[] = [{ 'x-tenant-id': 'default' }, { 'x-organization-id': 'foreign' }, { 'x-hanasand-server-session-validated': '1' }]
        for (const headers of spoofed) {
            ok((await call(retryPath, { itemIds: [itemId] }, { headers })).status >= 400)
        }
        eq(await countProofs(), beforeProof + 3)
        eq((await call(retryPath, { itemIds: [itemId, 'foreign'] })).status, 404)
        const beforeReads = await countProofs()
        for (const direct of [false, true]) for (const path of [root, `${root}/${encodeURIComponent(itemId)}`, `${root}/alert-terms`]) {
            const beforeRead = await countProofs()
            const readProof = proof(token, path, direct, { method: 'GET' })
            const headers: Record<string, string> = { DPoP: readProof, 'x-device-proof-method': 'GET', 'x-device-proof-url': `https://${direct ? 'api.' : ''}hanasand.com${path}`,
                ...(direct ? { authorization: `Bearer ${token}`, id: 'synthetic-customer', 'x-organization-id': org, 'x-tenant-id': org }
                    : { cookie: `id=synthetic-customer; access_token=${token}` }) }
            const response = await fetch(`${direct ? core : website}${path}`, { headers, signal: AbortSignal.timeout(10000) })
            eq(response.status, 200)
            const body = await response.json() as Record<string, any>
            eq(body.organization.id, org)
            const items = path === root ? body.watchlistItems : path.endsWith('/alert-terms') ? body.alertTermsExport.activeTerms : [body.watchlistItem]
            eq(items.map((item: Record<string, unknown>) => [item.watchlistItemId, item.organizationId, item.value || item.term]), [[itemId, org, 'synthetic-watchlist.example']])
            eq(await countProofs(), beforeRead + 1)
            if (!direct) {
                eq((await fetch(`${website}${path}`, { headers, signal: AbortSignal.timeout(10000) })).status, 401)
                eq(await countProofs(), beforeRead + 1)
            }
        }
        eq(await countProofs(), beforeReads + 6)
        eq(JSON.stringify(await sourceRows()), sourceSnapshot)
        eq(JSON.stringify((await source.query('SELECT updated_at FROM organizations WHERE id=$1', [org])).rows), orgSnapshot)
        const recordSnapshot = JSON.stringify((await projection.query('SELECT * FROM threat_intel.workflow_records ORDER BY id')).rows)
        await source.query(`CREATE FUNCTION stage_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id='stage-audit-fail' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER stage_reject_audit BEFORE INSERT ON system_events FOR EACH ROW EXECUTE FUNCTION stage_reject_audit()`)
        auditTrigger = true
        eq((await call(retryPath, { itemIds: [itemId], requestId: 'stage-audit-fail' })).status, 500)
        eq(JSON.stringify((await projection.query('SELECT * FROM threat_intel.workflow_records ORDER BY id')).rows), recordSnapshot)
        eq(JSON.stringify(await sourceRows()), sourceSnapshot)
        await source.query('DROP TRIGGER stage_reject_audit ON system_events; DROP FUNCTION stage_reject_audit()'); auditTrigger = false
        const cleanup = await call(`${root}/cleanup`, { itemIds: [itemId], requestId: 'stage-selected-cleanup' })
        eq(cleanup.status, 200); eq(cleanup.body.cleanup.archivedCount, 1)
        eq(cleanup.body.dwmAlertBridge.alertRebuild.status, 'not_requested')
        eq((await sourceRows())[0].status, 'archived')
        eq((await projection.query('SELECT record->>\'status\' AS status FROM threat_intel.workflow_records')).rows[0].status, 'paused')
        const types = (await projection.query('SELECT DISTINCT record_type FROM threat_intel.workflow_records')).rows.map(row => row.record_type)
        eq(types, ['dwm_watchlist'])
        const views = (await api.query('SELECT relkind FROM pg_class WHERE oid IN (\'public.users\'::regclass,\'public.organization_watchlist_items\'::regclass,\'public.system_events\'::regclass)')).rows
        eq(views.length, 3); ok(views.every(row => row.relkind === 'v'))
        eq((await api.query('SELECT count(*) FROM api_rate_limit_buckets')).rows[0].count === '0', false)
        console.log(`watchlists_full_topology_assertions=${assertions}; no generated alert/case/plan/run/delivery records; source and direct audit are in Identity database`)
    } finally {
        if (lock) await projection.query('ROLLBACK').catch(() => {})
        if (auditTrigger) await source.query('DROP TRIGGER stage_reject_audit ON system_events; DROP FUNCTION stage_reject_audit()').catch(() => {})
        await Promise.all(clients.map(client => client.end()))
    }
})
