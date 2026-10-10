import { randomUUID } from 'node:crypto'
import run from '#db'

const REFRESH_INTERVAL_MS = 15_000
const LOOKBACK_MINUTES = 10
const WINDOW_SECONDS = 60
const REQUEST_THRESHOLD = 1_000
const pattern = [
    { path: 'message', operator: 'equals', value: 'POST /api/vm/details failed with 401 invalid_session', caseSensitive: true },
    { path: 'metadata.user_agent', operator: 'equals', value: 'curl/8.5.0', caseSensitive: true },
]

type RateWindow = { organization_id: string, rule_id: string, rule_version: string, bucket: Date, hits: string }

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

async function refreshDropRateAlerts() {
    const windows = await run(`WITH target_rules AS MATERIALIZED (
            SELECT organization_id, rule_id, version
            FROM rules
            WHERE enabled IS TRUE AND source='owned'
              AND definition->>'stage'='analyze' AND definition->>'action'='drop'
              AND definition->'conditions' @> $1::jsonb
        )
        SELECT target.organization_id, target.rule_id, target.version AS rule_version,
            date_trunc('minute', receipt.created_at) AS bucket, count(*)::bigint AS hits
        FROM target_rules target
        JOIN log_analyze_receipts receipt
          ON receipt.organization_id=target.organization_id AND receipt.rule_id=target.rule_id
        WHERE receipt.created_at >= date_trunc('minute', NOW()) - ($2::int * INTERVAL '1 minute')
          AND receipt.created_at < date_trunc('minute', NOW())
        GROUP BY target.organization_id, target.rule_id, target.version, date_trunc('minute', receipt.created_at)
        HAVING count(*) >= $3
        ORDER BY bucket`, [JSON.stringify(pattern), LOOKBACK_MINUTES, REQUEST_THRESHOLD])

    if (!windows.rows.length) return
    const alerts = (windows.rows as RateWindow[]).map(window => {
        const bucketStart = new Date(window.bucket).toISOString()
        const eventId = randomUUID()
        const findingKey = `${window.organization_id}:${window.rule_id}:rate:${bucketStart}`
        const summary = 'Possible brute force against /api/vm/details'
        const evidence = { endpoint: '/api/vm/details', response: '401 invalid_session', userAgent: 'curl/8.5.0',
            bucketStart, windowSeconds: WINDOW_SECONDS, requestCountAtLeast: Number(window.hits), threshold: REQUEST_THRESHOLD }
        const normalized = { schema_version: 'logs.v1', event_type: 'network', action: 'alert', log_type: 'HttpLogs',
            severity: 'high', service: 'access-analyzer', message: summary, evidence,
            detections: [{ rule_id: window.rule_id, rule_version: window.rule_version, severity: 'high', summary, event_ids: [eventId], evidence }] }
        return { event_id: eventId, finding_id: randomUUID(), finding_key: findingKey,
            organization_id: window.organization_id, rule_id: window.rule_id, summary,
            evidence, normalized }
    })

    await run(`WITH input AS MATERIALIZED (
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
