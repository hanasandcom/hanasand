import { randomUUID } from 'node:crypto'
import run from '#db'

const REFRESH_INTERVAL_MS = 15_000
const LOOKBACK_MINUTES = 10
const WINDOW_SECONDS = 60
const targets = [
    {
        conditions: [
            { path: 'message', operator: 'equals', value: 'POST /api/vm/details failed with 401 invalid_session', caseSensitive: true },
            { path: 'metadata.user_agent', operator: 'equals', value: 'curl/8.5.0', caseSensitive: true },
        ],
        min_hits: 1_000,
        threshold: 1_000,
        summary: 'Possible brute force against /api/vm/details',
        evidence: { endpoint: '/api/vm/details', response: '401 invalid_session', userAgent: 'curl/8.5.0' },
    },
    {
        conditions: [
            { path: 'message', operator: 'equals', value: 'Pool currently unavailable, retrying in 5s...', caseSensitive: true },
            { path: 'host', operator: 'equals', value: 'hanasand', caseSensitive: true },
            { path: 'service', operator: 'equals', value: '3ab01ee97265_hanasand_api', caseSensitive: true },
            { path: 'event_type', operator: 'equals', value: 'application', caseSensitive: true },
            { path: 'action', operator: 'equals', value: 'log', caseSensitive: true },
            { path: 'metadata.collector', operator: 'equals', value: 'docker', caseSensitive: true },
        ],
        min_hits: 21,
        threshold: 20,
        summary: 'Database connection pool repeatedly unavailable',
        evidence: { message: 'Pool currently unavailable, retrying in 5s...', host: 'hanasand', service: '3ab01ee97265_hanasand_api' },
    },
]

type RateWindow = { organization_id: string, rule_id: string, rule_version: string, bucket: Date, hits: string,
    threshold: number, summary: string, evidence: Record<string, unknown> }

export function startDropRateAlertRefresh(logger: { warn: (context: { error: unknown }, message: string) => void }) {
    let inProgress: Promise<void> | null = null
    const refresh = () => {
        if (inProgress) return
        inProgress = refreshDropRateAlerts().catch(error => logger.warn({ error }, 'Drop-rule rate alert refresh failed')).finally(() => {
            inProgress = null
        })
    }
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS)
    timer.unref()
    refresh()
    return () => clearInterval(timer)
}

export async function refreshDropRateAlerts(query: typeof run = run) {
    const windows = await query(`WITH patterns AS (
            SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
                conditions jsonb, min_hits integer, threshold integer, summary text, evidence jsonb)
        ), target_rules AS MATERIALIZED (
            SELECT r.organization_id, r.rule_id, r.version, pattern.min_hits, pattern.threshold,
                pattern.summary, pattern.evidence
            FROM rules r JOIN patterns pattern ON r.definition->'conditions' @> pattern.conditions
            WHERE r.enabled IS TRUE AND r.source='owned'
              AND r.definition->>'stage'='analyze' AND r.definition->>'action'='drop'
        )
        SELECT target.organization_id, target.rule_id, target.version AS rule_version,
            date_trunc('minute', receipt.created_at) AS bucket, count(*)::bigint AS hits,
            target.threshold, target.summary, target.evidence
        FROM target_rules target
        JOIN log_analyze_receipts receipt
          ON receipt.organization_id=target.organization_id AND receipt.rule_id=target.rule_id
        WHERE receipt.created_at >= date_trunc('minute', NOW()) - ($2::int * INTERVAL '1 minute')
          AND receipt.created_at < date_trunc('minute', NOW())
        GROUP BY target.organization_id, target.rule_id, target.version, target.min_hits,
            target.threshold, target.summary, target.evidence, date_trunc('minute', receipt.created_at)
        HAVING count(*) >= target.min_hits
        ORDER BY bucket`, [JSON.stringify(targets), LOOKBACK_MINUTES])

    if (!windows.rows.length) return
    const alerts = (windows.rows as RateWindow[]).map(window => {
        const bucketStart = new Date(window.bucket).toISOString()
        const eventId = randomUUID()
        const findingKey = `${window.organization_id}:${window.rule_id}:rate:${bucketStart}`
        const summary = window.summary
        const evidence = { ...window.evidence, bucketStart, windowSeconds: WINDOW_SECONDS,
            requestCountAtLeast: Number(window.hits), threshold: window.threshold }
        const normalized = { schema_version: 'logs.v1', event_type: 'network', action: 'alert', log_type: 'HttpLogs',
            severity: 'high', service: 'access-analyzer', message: summary, evidence,
            detections: [{ rule_id: window.rule_id, rule_version: window.rule_version, severity: 'high', summary, event_ids: [eventId], evidence }] }
        return { event_id: eventId, finding_id: randomUUID(), finding_key: findingKey,
            organization_id: window.organization_id, rule_id: window.rule_id, summary,
            evidence, normalized }
    })

    await query(`WITH input AS MATERIALIZED (
            SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
                event_id text, finding_id text, finding_key text, organization_id text,
                rule_id text, summary text, evidence jsonb, normalized jsonb)
        ), inserted_findings AS (
            INSERT INTO findings(id,organization_id,finding_key,rule_id,severity,summary,evidence,event_ids)
            SELECT finding_id,organization_id,finding_key,rule_id,'high',summary,evidence,ARRAY[event_id]
            FROM input ORDER BY finding_key
            ON CONFLICT(finding_key) DO NOTHING
            RETURNING finding_key
        )
        INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,event_type,action,outcome,normalized,processing_status)
        SELECT item.event_id,'logs',item.organization_id,NOW(),'network','alert','unknown',item.normalized,'processed'
        FROM input item JOIN inserted_findings finding USING(finding_key)`, [JSON.stringify(alerts)])
}
