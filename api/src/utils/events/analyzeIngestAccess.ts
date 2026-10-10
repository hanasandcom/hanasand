import { createHash, randomUUID } from 'node:crypto'
import ipaddr from 'ipaddr.js'
import run from '#db'
import { matchesRule, type Condition } from './conditions.ts'

export const ingestAccessRuleId = 'http.log_ingest_access.v1'
const COUNTER_FLUSH_INTERVAL_MS = 60_000
const pendingHits = new Map<string, PendingHit>()
let pendingBatch: PendingBatch | null = null
let flushInProgress: Promise<void> | null = null
let lastCounterCleanup = Date.now()

type PendingHit = { organizationId: string, bucket: string, ip: string, hits: number }
type PendingBatch = { id: string, rows: PendingHit[] }

export const ingestAccessRule = {
    id: ingestAccessRuleId, version: '1', name: 'Compact internal log-ingest access records', family: 'HTTP', severity: 'low', enabled: true,
    explanation: 'Count successful internal log-ingest requests, retain failures, and alert when endpoint traffic exceeds 1,000 requests in a minute.',
    evidence: ['source IP', 'minute request count', 'endpoint'],
}
export const ingestAccessDefinition = { match: 'all' as const, conditions: [
    { path: 'service', operator: 'equals', value: 'http-traffic' },
    { path: 'http.path', operator: 'equals', value: '/api/logs/ingest' },
    { path: 'http.status_code', operator: 'equals', value: '201' },
    { path: 'source.ip', operator: 'equals', value: '172.20.0.1' },
].map(condition => ({ ...condition, caseSensitive: true })) as Condition[], stage: 'analyze' as const, action: 'drop' as 'drop' | 'keep', parameters: { requestThreshold: 1000 } }

type IngestAccess = { key: string, ip: string, timestamp: string, path: string, method: string, status: number }
type IngestLog = { service: string, host: string, level: string, message: string, metadata: Record<string, unknown> }

export async function analyzeIngestAccess(access: IngestAccess, host: string, userAgent: string, query: typeof run = run): Promise<{ monitored: boolean, drop: boolean }> {
    if (access.path !== '/api/logs/ingest') return { monitored: false, drop: false }
    if (!ipaddr.isValid(access.ip) || !Number.isInteger(access.status) || !Number.isFinite(Date.parse(access.timestamp)) || !access.key) return { monitored: false, drop: false }

    const rule = (await query(`SELECT o.id AS organization_id, r.enabled, r.version, r.definition
        FROM organizations o LEFT JOIN rules r ON r.organization_id=o.id AND r.rule_id=$2
        WHERE o.status='active' AND (o.id=$1 OR ($1::text IS NULL AND lower(o.name)='hanasand'))
        ORDER BY o.created_at LIMIT 1`, [process.env.PLATFORM_LOG_ORGANIZATION_ID || null, ingestAccessRuleId])).rows[0]
    if (!rule?.enabled || rule.definition?.stage !== 'analyze') return { monitored: false, drop: false }

    const ip = ipaddr.process(access.ip).toString()
    queueIngestHit(rule.organization_id, access.timestamp, ip)

    const event: IngestLog = { service: 'http-traffic', host, level: access.status >= 400 ? 'error' : 'info',
        message: `${access.method} ${access.path} → ${access.status}`,
        metadata: { category: 'http', action: 'request', outcome: access.status >= 400 ? 'failure' : 'success', path: access.path,
            method: access.method, status_code: access.status, source: { ip }, user_agent: userAgent } }
    const normalized = { ...event, http: { path: access.path, method: access.method, status_code: access.status }, source: { ip }, severity: 'low' }
    const shouldDrop = rule.definition.action === 'drop' && Array.isArray(rule.definition.conditions)
        && matchesRule(normalized, rule.definition.conditions)
    if (shouldDrop) {
        const key = createHash('sha256').update(`custom:${ingestAccessRuleId}:${access.key}`).digest('hex')
        await query(`INSERT INTO log_analyze_receipts(key,organization_id,rule_id,rule_version)
            VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [key, rule.organization_id, ingestAccessRuleId, rule.version || '1'])
    }
    return { monitored: true, drop: shouldDrop }
}

export function startIngestAccessCounterRefresh(logger: { warn: (context: { error: unknown }, message: string) => void }) {
    const refresh = () => {
        void flushIngestAccessCounters().catch(error => logger.warn({ error }, 'Log-ingest counter refresh failed'))
    }
    const timer = setInterval(refresh, COUNTER_FLUSH_INTERVAL_MS)
    timer.unref()
    refresh()
    return async() => {
        clearInterval(timer)
        if (pendingHits.size || pendingBatch) await flushIngestAccessCounters()
    }
}

function queueIngestHit(organizationId: string, timestamp: string, ip: string) {
    const minute = Math.floor(Date.parse(timestamp) / 60_000) * 60_000
    const bucket = new Date(minute).toISOString()
    const key = JSON.stringify([organizationId, bucket, ip])
    const pending = pendingHits.get(key)
    if (pending) pending.hits++
    else pendingHits.set(key, { organizationId, bucket, ip, hits: 1 })
}

async function flushIngestAccessCounters() {
    if (flushInProgress) return flushInProgress
    flushInProgress = flushPendingIngestAccessCounters()
    try {
        await flushInProgress
    } finally {
        flushInProgress = null
    }
}

async function flushPendingIngestAccessCounters() {
    if (!pendingBatch && pendingHits.size) {
        pendingBatch = { id: randomUUID(), rows: [...pendingHits.values()] }
        pendingHits.clear()
    }

    const batch = pendingBatch
    if (batch) {
        await run(`INSERT INTO log_ingest_access_minute_batches(batch_id,organization_id,bucket,ip,hits)
            SELECT $1::uuid,entry.organization_id,entry.bucket::timestamptz,entry.ip::inet,entry.hits
            FROM jsonb_to_recordset($2::jsonb) AS entry(organization_id text,bucket text,ip text,hits bigint)
            ON CONFLICT DO NOTHING`, [batch.id, JSON.stringify(batch.rows)])
        pendingBatch = null
    }

    const organizations = await run(`SELECT DISTINCT organization_id
        FROM log_ingest_access_minute_batches WHERE bucket >= NOW() - INTERVAL '10 minutes'`)
    for (const row of organizations.rows) await checkIngestThreshold(row.organization_id)

    if (Date.now() - lastCounterCleanup >= 60 * 60_000) {
        await run('DELETE FROM log_ingest_access_minute_batches WHERE bucket < NOW() - INTERVAL \'7 days\'')
        await run('DELETE FROM log_ingest_access_ip_minutes WHERE bucket < NOW() - INTERVAL \'7 days\'')
        lastCounterCleanup = Date.now()
    }
}

async function checkIngestThreshold(organizationId: string) {
    const result = await run(`SELECT r.version, r.definition
        FROM rules r JOIN organizations o ON o.id=r.organization_id AND o.status='active'
        WHERE r.organization_id=$1 AND r.rule_id=$2 AND r.enabled IS TRUE`, [organizationId, ingestAccessRuleId])
    const rule = result.rows[0]
    if (!rule || rule.definition?.stage !== 'analyze') return
    const threshold = Number.isInteger(rule.definition.parameters?.requestThreshold) ? rule.definition.parameters.requestThreshold : 1000

    // This is a plain MVCC read: threshold checks never claim or update counter rows.
    const windows = await run(`SELECT bucket, SUM(hits)::bigint AS hits
        FROM log_ingest_access_minute_batches
        WHERE organization_id=$1 AND bucket >= date_trunc('minute', NOW()) - INTERVAL '10 minutes'
          AND bucket < date_trunc('minute', NOW())
        GROUP BY bucket HAVING SUM(hits) > $2 ORDER BY bucket`, [organizationId, threshold])
    for (const window of windows.rows) {
        const sources = (await run(`SELECT ip::text AS ip, SUM(hits)::bigint AS hits
            FROM log_ingest_access_minute_batches WHERE organization_id=$1 AND bucket=$2
            GROUP BY ip ORDER BY SUM(hits) DESC, ip LIMIT 10`, [organizationId, window.bucket])).rows
        await createIngestThresholdFinding(organizationId, rule.version || '1', window.bucket, Number(window.hits), threshold, sources)
    }
}

async function createIngestThresholdFinding(organizationId: string, version: string, bucket: string, hits: number, threshold: number, sources: Array<{ ip: string, hits: string }>) {
    const evidence = { endpoint: '/api/logs/ingest', method: 'POST', windowSeconds: 60,
        bucketStart: new Date(bucket).toISOString(), requestCountAtLeast: hits, threshold, sourceCounts: sources }
    const eventId = randomUUID(), findingId = randomUUID(), summary = 'Possible DDoS activity on the log-ingest endpoint'
    const sourceIp = sources[0]?.ip || '0.0.0.0'
    const normalized = { schema_version: 'logs.v1', event_type: 'network', action: 'alert', log_type: 'HttpLogs', severity: 'high',
        service: 'access-analyzer', message: summary, source: { ip: sourceIp }, evidence,
        detections: [{ rule_id: ingestAccessRuleId, rule_version: version, severity: 'high', summary, event_ids: [eventId], evidence }] }
    const findingKey = `${organizationId}:${ingestAccessRuleId}:${new Date(bucket).toISOString()}`
    await run(`WITH inserted_finding AS (
            INSERT INTO findings(id,organization_id,finding_key,rule_id,severity,summary,evidence,event_ids)
            VALUES($1,$2,$3,$4,'high',$5,$6::jsonb,$7::text[])
            ON CONFLICT(finding_key) DO NOTHING RETURNING id
        )
        INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,source_ip,normalized,processing_status)
        SELECT $8,'logs',$2,NOW(),'network','alert','unknown',$9,$10::jsonb,'processed' FROM inserted_finding`,
    [findingId, organizationId, findingKey, ingestAccessRuleId, summary, JSON.stringify(evidence), [eventId], eventId, sourceIp, JSON.stringify(normalized)])
}
