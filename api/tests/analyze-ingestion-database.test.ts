import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { readFileSync } from 'node:fs'
import pg from 'pg'

function fixture() {
    const reqId = '67d04ac9-630e-4d75-a2b5-33ba95b81842'
    const timestamp = '2026-09-24T00:00:00.000Z'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 123, hostname: 'api-test', reqId,
        msg: 'http_access', req: { method: 'POST', url: '/api/logs/ingest', body: { events: [{ message: 'retained submitted content' }] } },
        access: { key: `http-api:${reqId}`, ip: '127.0.0.1', timestamp, path: '/api/logs/ingest', method: 'POST', status: 201 } }
    return { service: 'hanasand-api-1', host: 'inspur', level: 'info' as const, timestamp, sourceEventId: 'a'.repeat(64),
        message: JSON.stringify(structured), metadata: { collector: 'docker', container_id: 'b'.repeat(64), stream: 'stdout', structured } }
}

async function waitFor<T>(promise: Promise<T>, description: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {
                timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${description}`)), 5000)
            }),
        ])
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}

async function cleanUpWithin<T>(promise: Promise<T>, description: string, errors: unknown[]): Promise<void> {
    try {
        await waitFor(promise, description)
    } catch (error) {
        errors.push(error)
    }
}

function assertCleanupSucceeded(errors: unknown[]): void {
    if (errors.length) throw new AggregateError(errors, 'Ingestion database test cleanup did not finish cleanly')
}

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('ingestion copies retain full canonical bodies, provenance, failures and current detector evidence', async () => {
    const port = Number(process.env.POSTGRES_FILTER_TEST_PORT)
    if (!Number.isInteger(port) || port < 1024) throw new Error('Disposable local test port required')
    const namespace = `ingestion_filter_${process.pid}_${Date.now()}`
    const pool = new pg.Pool({ options: `-c search_path=${namespace}`, host: '127.0.0.1', port, database: 'postgres_filter_test', max: 8 })
    const query = (sql: string, values?: unknown[]) => pool.query(sql, values)
    let holdCanonicalOriginalUpdate: { gate: Promise<void>, reached: () => void } | undefined
    let releaseOriginalUpdate = () => {}
    const transaction = async (work: (tx: typeof query) => Promise<unknown>) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const tx: typeof query = async (sql, values) => {
                if (holdCanonicalOriginalUpdate && sql.startsWith('UPDATE log_ingestion_canonical SET original')) {
                    holdCanonicalOriginalUpdate.reached()
                    await holdCanonicalOriginalUpdate.gate
                }
                return client.query(sql, values)
            }
            const result = await work(tx)
            await client.query('COMMIT'); return result
        } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
    }
    const identityQueryOnce = (sql: string, values?: unknown[]) => query(sql.replace('public.system_events', 'system_events'), values)
    mock.module('#db', () => ({
        default: query,
        identityQueryOnce,
        isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof query) => unknown) => work(query),
        withTransaction: transaction,
    }))
    mock.module('#constants', () => ({ default: { DB_MAX_CONN: '4' } }))
    mock.module('#utils/auth/logIngestToken.ts', () => ({ hasLogIngestToken: () => true }))
    mock.module('#utils/auth/internalToken.ts', () => ({ default: () => false }))
    const { ingestionRuleId, ingestionDefinition } = await import('../src/utils/events/analyzeIngestion.ts')
    const { default: ingestLog } = await import('../src/handlers/logs/ingest.ts')
    const app = Fastify()
    let firstCopy: ReturnType<typeof app.inject> | undefined
    let busyRequest: ReturnType<typeof app.inject> | undefined
    try {
        expect((await query('SELECT current_database() name')).rows[0].name).toBe('postgres_filter_test')
        await query(`CREATE SCHEMA ${namespace}`)
        await query('CREATE TABLE users(id text PRIMARY KEY)')
        await query('CREATE TABLE organizations(id text PRIMARY KEY,name text,status text,created_at timestamptz DEFAULT NOW(),audit_safe_metadata jsonb DEFAULT \'{}\')')
        await query('INSERT INTO organizations(id,name,status) VALUES(\'platform\',\'Hanasand\',\'active\')')
        const schema = readFileSync(new URL('../src/utils/db/ensureSchema.ts', import.meta.url), 'utf8')
        for (const table of ['events', 'rules', 'system_events']) {
            const definition = schema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
            if (!definition) throw new Error(`Missing schema ${table}`)
            await query(definition)
        }
        const { default: install } = await import('../src/utils/db/logAnalyzeSchema.ts')
        const { recordLogBatch } = await import('../src/utils/logs/recordLog.ts')
        const { normalizeBuiltinDefinition } = await import('../src/handlers/events.ts')
        await install()
        app.post('/api/logs/ingest', ingestLog)
        expect(normalizeBuiltinDefinition(ingestionRuleId, ingestionDefinition).definition).toEqual(ingestionDefinition)
        expect(normalizeBuiltinDefinition(ingestionRuleId, { ...ingestionDefinition, conditions: [{ path: 'service', operator: 'equals', value: 'anything' }] }).error).toBeUndefined()
        const ingest = (logs: ReturnType<typeof fixture>[]) => transaction(tx => recordLogBatch(logs, tx as any))
        const count = async (table: 'log_ingestion_copies' | 'log_analyze_receipts') => Number((await query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
        const countLogs = async () => Number((await query('SELECT count(*) n FROM events WHERE ingestion_id=\'logs\'')).rows[0].n)
        const countLog = async (sourceEventId: string) => Number((await query('SELECT count(*) n FROM events WHERE ingestion_id=\'logs\' AND normalized->>\'source_event_id\'=$1', [sourceEventId])).rows[0].n)
        const sendIngest = (log: ReturnType<typeof fixture>) => app.inject({ method: 'POST', url: '/api/logs/ingest', payload: { events: [log] } })
        const first = fixture(), copy = { ...fixture(), sourceEventId: 'c'.repeat(64), service: 'hanasand-api-2' }
        await ingest([first])
        expect(await countLogs()).toBe(1)
        expect((await query('SELECT original FROM log_ingestion_canonical')).rows[0].original).toBeNull()
        let signalOriginalUpdate!: () => void
        const originalUpdateReached = new Promise<void>(resolve => { signalOriginalUpdate = resolve })
        const originalUpdateGate = new Promise<void>(resolve => { releaseOriginalUpdate = resolve })
        holdCanonicalOriginalUpdate = { gate: originalUpdateGate, reached: signalOriginalUpdate }
        firstCopy = sendIngest(copy)
        await waitFor(originalUpdateReached, 'the first canonical original update')
        busyRequest = sendIngest(copy)
        const busyCopy = await waitFor(busyRequest, 'the capacity rejection')
        expect(busyCopy.statusCode).toBe(503)
        expect(busyCopy.headers['retry-after']).toBe('1')
        expect(busyCopy.json()).toMatchObject({ code: 'LOG_INGEST_BUSY' })
        releaseOriginalUpdate()
        expect((await waitFor(firstCopy, 'the first ingestion response')).statusCode).toBe(201)
        holdCanonicalOriginalUpdate = undefined
        expect((await sendIngest(copy)).statusCode).toBe(201)
        for (let attempt = 0; attempt < 6; attempt++) await ingest([copy])
        expect(await countLogs()).toBe(1)
        expect(await count('log_ingestion_copies')).toBe(1)
        expect(await count('log_analyze_receipts')).toBe(1)
        const canonical = (await query('SELECT original FROM log_ingestion_canonical')).rows[0].original
        const receipt = (await query('SELECT envelope FROM log_ingestion_copies')).rows[0].envelope
        expect(canonical.message).toBe(first.message)
        expect({ ...receipt, message: canonical.message, metadata: { ...receipt.metadata, structured: canonical.metadata.structured } }).toEqual(copy)
        const changed = { ...structuredClone(copy), sourceEventId: 'd'.repeat(64) }
        changed.metadata.structured.req.body.events[0].message = 'unique submitted content must remain'
        changed.message = JSON.stringify(changed.metadata.structured)
        await ingest([changed])
        expect(await countLogs()).toBe(2)
        const extra = { ...structuredClone(copy), sourceEventId: 'e'.repeat(64), metadata: { ...copy.metadata, extraEvidence: 'keep' } }
        await ingest([extra])
        expect(await countLogs()).toBe(3)
        const failure = { ...structuredClone(copy), sourceEventId: 'f'.repeat(64) }
        failure.metadata.structured.access.status = 503; failure.message = JSON.stringify(failure.metadata.structured)
        await ingest([failure]); expect(await countLogs()).toBe(4)
        const aborted = { ...copy, sourceEventId: '1'.repeat(64) }
        await expect(transaction(async tx => { await recordLogBatch([aborted], tx as any); throw new Error('abort') })).rejects.toThrow('abort')
        expect(await count('log_ingestion_copies')).toBe(1)
        await ingest([aborted]); expect(await count('log_ingestion_copies')).toBe(2)
        // Raw retention cannot erase the backed-up original or break exact replay.
        await query('DELETE FROM events WHERE ingestion_id=\'logs\' AND normalized->>\'source_event_id\'=$1', [first.sourceEventId])
        await ingest([copy]); expect(await count('log_ingestion_copies')).toBe(2)
        expect((await query('SELECT original FROM log_ingestion_canonical WHERE source_event_id=$1', [first.sourceEventId])).rows[0].original).toEqual(canonical)
        for (const [index, mode] of ['disable', 'keep', 'custom-keep', 'condition', 'detect'].entries()) {
            await query('DELETE FROM rules WHERE id IN (\'keep\',\'detect\')')
            await query('UPDATE rules SET enabled=true,definition=$2::jsonb WHERE rule_id=$1', [ingestionRuleId, JSON.stringify(ingestionDefinition)])
            if (mode === 'disable') await query('UPDATE rules SET enabled=false WHERE rule_id=$1', [ingestionRuleId])
            if (mode === 'keep') await query('UPDATE rules SET definition=jsonb_set(definition,\'{action}\',\'"keep"\') WHERE rule_id=$1', [ingestionRuleId])
            if (mode === 'condition') await query('UPDATE rules SET definition=jsonb_set(definition,\'{conditions}\',$2::jsonb) WHERE rule_id=$1', [ingestionRuleId, JSON.stringify([{ path: 'service', operator: 'equals', value: 'other' }])])
            if (mode === 'custom-keep' || mode === 'detect') await query(`INSERT INTO rules(id,organization_id,rule_id,version,name,family,severity,explanation,definition,source,enabled)
                VALUES($1,'platform',$1,'1','Protect copies','Custom','high','Protect copies',$2::jsonb,'owned',true)`,
            [mode === 'detect' ? 'detect' : 'keep', JSON.stringify({ match: 'all', stage: mode === 'detect' ? 'detect' : 'analyze', action: 'keep', conditions: [{ path: 'service', operator: 'equals', value: 'hanasand-api-2' }] })])
            const kept = { ...copy, sourceEventId: String(index + 2).repeat(64) }
            await ingest([kept])
            expect(await countLog(kept.sourceEventId)).toBe(1)
            expect(await count('log_ingestion_copies')).toBe(2)
        }
        await ingest([copy]) // New detector overrides even a previously compacted replay.
        expect(await countLog(copy.sourceEventId)).toBe(1)
        // Missing first evidence must retain the unmatched copy.
        await query('DELETE FROM rules WHERE id=\'detect\'')
        const expired = structuredClone(first)
        expired.sourceEventId = '7'.repeat(64)
        expired.metadata.structured.reqId = 'a7d04ac9-630e-4d75-a2b5-33ba95b81842'
        expired.metadata.structured.access.key = `http-api:${expired.metadata.structured.reqId}`
        expired.message = JSON.stringify(expired.metadata.structured)
        await ingest([expired])
        await query('DELETE FROM events WHERE ingestion_id=\'logs\' AND normalized->>\'source_event_id\'=$1', [expired.sourceEventId])
        const unmatched = { ...expired, sourceEventId: '8'.repeat(64) }
        await ingest([unmatched])
        expect(await countLog(unmatched.sourceEventId)).toBe(1)
        expect(await count('log_ingestion_copies')).toBe(2)
    } finally {
        releaseOriginalUpdate()
        holdCanonicalOriginalUpdate = undefined
        const cleanupErrors: unknown[] = []
        if (firstCopy) await cleanUpWithin(firstCopy, 'the first ingestion request during cleanup', cleanupErrors)
        if (busyRequest) await cleanUpWithin(busyRequest, 'the capacity-check request during cleanup', cleanupErrors)
        await cleanUpWithin(app.close(), 'Fastify shutdown', cleanupErrors)
        await cleanUpWithin(query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`), 'test schema cleanup', cleanupErrors)
        await cleanUpWithin(pool.end(), 'database pool shutdown', cleanupErrors)
        assertCleanupSucceeded(cleanupErrors)
    }
})
