import { expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import pg from 'pg'

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('self-ingestion replay removes only unprotected canonical events', async () => {
    const client = new pg.Client({host:'127.0.0.1',port:Number(process.env.POSTGRES_FILTER_TEST_PORT),database:'postgres_filter_test'})
    await client.connect()
    try {
        await client.query('BEGIN')
        await client.query(`CREATE TEMP TABLE organizations(id text PRIMARY KEY,name text,status text);
            INSERT INTO organizations VALUES('org','Test','active');
            CREATE TEMP TABLE rules(id text PRIMARY KEY,organization_id text,rule_id text,version text,name text,family text,severity text,
                explanation text,definition jsonb,source text,source_reference text,enabled boolean,created_at timestamptz DEFAULT NOW());
            CREATE TEMP TABLE events(id text PRIMARY KEY,organization_id text,source_vendor text,source_product text,normalized jsonb,original jsonb);
            CREATE TEMP TABLE findings(event_ids text[] NOT NULL);
            CREATE TEMP TABLE log_proxy_receipts(canonical_event_id text NOT NULL);
            CREATE TEMP TABLE log_ingestion_canonical(canonical_event_id text);
            CREATE TEMP TABLE log_analyze_receipts(key text PRIMARY KEY,organization_id text,rule_id text,rule_version text)`)
        const query = (sql: string, values?: unknown[]) => client.query(sql, values)
        mock.module('#db', () => ({ default: query, identityQueryOnce: query, isTransientDatabaseError: () => false,
            withTransaction: async (work: (run: typeof query) => Promise<unknown>) => work(query) }))
        const { reprocessRuleItems } = await import('../src/utils/events/ruleReprocess.ts')
        const conditions = [
            { path: 'http.path', value: '/api/logs/ingest', operator: 'equals', caseSensitive: true },
            { path: 'http.method', value: 'POST', operator: 'equals', caseSensitive: true },
            { path: 'http.status_code', value: '201', operator: 'equals', caseSensitive: true },
            { path: 'source.ip', value: '128.39.142.218', operator: 'equals', caseSensitive: true },
            { path: 'severity', value: 'low', operator: 'equals', caseSensitive: true },
            { path: 'service', value: '^(hanasand-api(-[1-4])?|http-traffic)$', operator: 'regex', caseSensitive: true },
        ]
        const rule = { rule_id: 'http.self_ingestion_success.v1', version: '1', source: 'owned', enabled: true,
            definition: { stage: 'analyze', action: 'drop', conditions } }
        const eventId = (label: string) => createHash('sha256').update(`service:${label}`).digest('hex')
        const entries = ['remove', 'finding', 'proxy', 'canonical'].map(label => ({ id: eventId(label), label, event: {
            source_vendor: 'Hanasand', source_product: 'Logs', service: 'hanasand-api', severity: 'low',
            event_type: 'application', action: 'log', outcome: 'success', message: 'self-ingestion response',
            http: { path: '/api/logs/ingest', method: 'POST', status_code: 201 }, source: { ip: '128.39.142.218' },
        }, original: {} }))
        for (const entry of entries) await query('INSERT INTO events VALUES($1,\'org\',\'Hanasand\',\'Logs\',$2::jsonb,$3::jsonb)',
            [entry.id, JSON.stringify(entry.event), JSON.stringify(entry.original)])
        await query('INSERT INTO findings VALUES($1::text[])', [[eventId('finding')]])
        await query('INSERT INTO log_proxy_receipts VALUES($1)', [eventId('proxy')])
        await query('INSERT INTO log_ingestion_canonical VALUES($1)', [eventId('canonical')])
        const result = await reprocessRuleItems(entries, { organization_id: 'org' }, rule as any, query as any)
        expect(result).toEqual({ matched: 4, protected: 3, removedEvents: 1, removedSources: 0 })
        expect((await query('SELECT id FROM events ORDER BY id')).rows.map(row => row.id)).toEqual([eventId('canonical'), eventId('finding'), eventId('proxy')].sort())
        expect((await query('SELECT rule_id FROM log_analyze_receipts')).rows).toEqual([{ rule_id: rule.rule_id }])
    } finally { await client.query('ROLLBACK'); await client.end() }
})

test.skipIf(!process.env.POSTGRES_FILTER_TEST_PORT)('bulk replay reporting cleanup preserves exact counts and organization boundaries', async () => {
    const client = new pg.Client({host:'127.0.0.1',port:Number(process.env.POSTGRES_FILTER_TEST_PORT),user:'postgres',database:'postgres_filter_test'})
    await client.connect()
    try {
        await client.query('BEGIN')
        const namespace=`cleanup_counts_${process.pid}`
        await client.query(`CREATE SCHEMA ${namespace}; SET LOCAL search_path TO ${namespace}`)
        await client.query('CREATE TABLE events(id text PRIMARY KEY,organization_id text); CREATE TABLE log_dimensions(event_id text PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,organization_id text,event_timestamp timestamptz,severity text,service text,log_type text)')
        const {logCountsSchema}=await import('../src/utils/db/logCountsSchema.ts')
        for(const sql of logCountsSchema) await client.query(sql)
        await client.query('INSERT INTO events VALUES(\'remove\',\'org\'),(\'keep\',\'org\'),(\'other\',\'other\'); INSERT INTO log_dimensions SELECT id,organization_id,\'2026-09-24T10:00Z\',\'low\',\'test\',\'HttpLogs\' FROM events')
        const source=readFileSync(new URL('../scripts/drop-self-ingestion-responses.ts',import.meta.url),'utf8')
        const remove=source.match(/`(DELETE FROM log_dimensions d[\s\S]*?ANY\(\$2::text\[\]\))`/)![1]
        await client.query(remove,['org',['remove','other']])
        await client.query('DELETE FROM events WHERE organization_id=$1 AND id=ANY($2::text[])',['org',['remove','other']])
        expect((await client.query('SELECT event_id FROM log_dimensions ORDER BY event_id')).rows.map(row=>row.event_id)).toEqual(['keep','other'])
        expect((await client.query('SELECT event_count FROM log_counts ORDER BY bucket_seconds,organization_id')).rows.map(row=>Number(row.event_count))).toEqual([1,1,1,1,1,1])
    } finally { await client.query('ROLLBACK'); await client.end() }
})
