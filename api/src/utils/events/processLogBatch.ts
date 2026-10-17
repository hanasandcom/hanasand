import { createHash } from 'node:crypto'
import run, { withTransaction } from '#db'
import { collectEventFindings, createFindings, persistEventFindings } from '../../handlers/events/findingEngine.ts'
import { loadConfiguredRules } from '../../handlers/events/ruleStorage.ts'
import { normalizeEvent } from '../../handlers/events/eventNormalization.ts'
import { normalizeLogEvent, severityOrder, type LogInput } from './logEvent.ts'
import { pruneAccessLogs } from './pruneAccessLogs.ts'
import { accessRuleId } from './analyzeAccess.ts'
import { customRetentionAction, loadLogRetentionRules, recordCustomDropReceipts } from './customRetention.ts'

const AUTH_CORRELATION_RECHECK_LIMIT = 25

function eventIdForLog(log: Pick<LogInput, 'id' | 'eventId'>) {
    return log.eventId || createHash('sha256').update(`service:${log.id}`).digest('hex')
}

export async function processLog(log: LogInput, organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    return processLogBatch([log], organizationId, rules)
}

export async function processLogBatch(logs: LogInput[], organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    if (!logs.length) return
    const droppedLogins = await pruneLoginMonitorEvents(logs, organizationId, rules)
    if (droppedLogins.size) logs = logs.filter(log => !droppedLogins.has(String(log.id)))
    if (!logs.length) return
    if (rules.some(rule => rule.id === accessRuleId && rule.enabled !== false && rule.definition?.action === 'drop')) {
        const dropped = await pruneAccessLogs(logs, organizationId)
        logs = logs.filter(log => !dropped.has(String(log.id)))
        if (!logs.length) return
    }
    // Priority delivery and retry can overlap the historical cursor. Read the
    // acknowledgement before normalization instead of locking completed rows again.
    const eventIds = logs.map(eventIdForLog)
    const completed = await run('SELECT id FROM events WHERE id = ANY($1::text[]) AND processing_status = \'processed\'', [eventIds])
    const completedKeys = new Set(completed.rows.map(row => row.id))
    const prepared = logs.filter(log => !completedKeys.has(eventIdForLog(log))).map(log => {
        const event = normalizeEvent(normalizeLogEvent(log, rules), { vendor: 'Hanasand', product: 'Logs' })
        if (log.source_event_id) event.normalized.source_event_id = log.source_event_id
        const id = eventIdForLog(log)
        // Stateless rules can finish before persistence. Login correlation still needs
        // the durable event-time history and retains the retryable pending path.
        const correlates = event.eventType === 'authentication' && event.action === 'login'
        const findings = correlates ? []
            : collectEventFindings(organizationId, id, event, rules).findings
        const complete = !correlates
        if (complete) Object.assign(event.normalized, { detections: [], evaluated_at: new Date().toISOString(),
            rules_checked: rules.filter(rule => rule.enabled !== false).length })
        return { id, event, complete, findings }
    })
    if (!prepared.length) return
    await withTransaction(async query => {
        await query('SET LOCAL lock_timeout=\'1ms\'')
        const stateless = prepared.filter(item => item.complete)
        if (stateless.length) {
            // Preserve findings from a previously interrupted attempt. New stateless
            // results and their event become visible together at commit.
            const existing = await query('SELECT rule_id, severity, summary, evidence, event_ids FROM findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, stateless.map(item => item.id)])
            for (const item of stateless) {
                const detections = new Map(item.findings.map(([, rule_id, severity, summary, event_ids, evidence]) =>
                    [`${rule_id}:${event_ids.slice().sort().join(',')}`, { rule_id, severity, summary, event_ids, evidence: { ...evidence, restrictedLog: true } }]))
                for (const finding of existing.rows.filter(row => row.event_ids.includes(item.id)))
                    detections.set(`${finding.rule_id}:${[...finding.event_ids].sort().join(',')}`, finding)
                let severity = String(item.event.normalized.severity)
                for (const finding of detections.values()) if (severityOrder.indexOf(finding.severity as typeof severityOrder[number]) > severityOrder.indexOf(severity as typeof severityOrder[number])) severity = finding.severity
                Object.assign(item.event.normalized, { detections: [...detections.values()], severity })
            }
        }
        const written = await query(`INSERT INTO events (id, ingestion_id, organization_id, source_vendor, source_product, event_timestamp,
        event_type, action, outcome, user_id, user_email, source_ip, source_country, source_city, device_id, parser_version, normalized, original, processing_status)
        SELECT item.id, 'logs', $2, 'Hanasand', 'Logs', item.timestamp::timestamptz, item.event_type,
            item.action, item.outcome, item.user_id, item.user_email, item.source_ip, item.source_country, item.source_city, item.device_id, item.parser_version, item.normalized, '{}'::jsonb, item.processing_status
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, timestamp text, event_type text, action text, outcome text, user_id text, user_email text, source_ip text, source_country text, source_city text, device_id text, parser_version text, normalized jsonb, processing_status text)
        WHERE EXISTS (SELECT 1 FROM organizations WHERE id = $2 AND status = 'active')
        ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,
            event_timestamp=EXCLUDED.event_timestamp, event_type=EXCLUDED.event_type, action=EXCLUDED.action, outcome=EXCLUDED.outcome,
            user_id=EXCLUDED.user_id, user_email=EXCLUDED.user_email, source_ip=EXCLUDED.source_ip, source_country=EXCLUDED.source_country,
            source_city=EXCLUDED.source_city, device_id=EXCLUDED.device_id, parser_version=EXCLUDED.parser_version,
            normalized=EXCLUDED.normalized, original=EXCLUDED.original, processing_status=EXCLUDED.processing_status
        WHERE events.ingestion_id='logs' AND (events.processing_status='pending'
          OR (events.processing_status='skipped' AND events.normalized->>'processing_reason'='Organization is missing or inactive')) RETURNING id `, [JSON.stringify(prepared.map(({ id, event, complete }) => ({ id, processing_status: complete ? 'processed' : 'pending', timestamp: event.timestamp, event_type: event.eventType, action: event.action, outcome: event.outcome, user_id: event.userId, user_email: event.userEmail, source_ip: event.sourceIp, source_country: event.sourceCountry, source_city: event.sourceCity, device_id: event.deviceId, parser_version: event.parserVersion, normalized: event.normalized }))), organizationId])
        const writtenIds = new Set(written.rows.map(row => row.id))
        await persistEventFindings(stateless.filter(item => writtenIds.has(item.id)).flatMap(item => item.findings), query)
    })
    const correlationCandidates = prepared.filter(item => !item.complete)
    if (!correlationCandidates.length) return
    const pending = await run('SELECT id FROM events WHERE id = ANY($1::text[]) AND organization_id = $2 AND processing_status <> \'processed\'', [correlationCandidates.map(item => item.id), organizationId])
    const pendingIds = new Set(pending.rows.map(row => row.id))
    const work = correlationCandidates.filter(item => pendingIds.has(item.id))
    if (!work.length) return
    const auth = work.filter(item => item.event.eventType === 'authentication' && item.event.action === 'login')
    const windowMinutes = Math.max(0, ...rules.filter(rule => rule.enabled !== false && rule.id.startsWith('auth.')).map(rule => Number(rule.definition?.parameters?.windowMinutes || 0)))
    if (auth.length && windowMinutes) {
        // Late delivery/backfill can provide the missing precursor to a login
        // already checked by the fresh stream. Revisit only matching identities
        // inside a configured correlation window, in bounded pages.
        // Keep each correlation on its matching index. A shared source IP can
        // match an organization's full login history, so each rule lane gets
        // one bounded page and can never pin the worker while scanning it all.
        for (const { event } of auth) {
            const later = await run(`WITH later_users AS (
                    SELECT e.id, e.normalized, e.event_timestamp FROM events e
                    WHERE e.organization_id = $1 AND $2::text IS NOT NULL AND e.user_id = $2
                      AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
                      AND e.event_type = 'authentication' AND e.action = 'login' AND e.outcome = 'success'
                      AND e.event_timestamp > $5::timestamptz AND e.event_timestamp <= $5::timestamptz + $6 * INTERVAL '1 minute'
                    ORDER BY e.event_timestamp, e.id LIMIT $7
                ), later_source_ip AS (
                    SELECT e.id, e.normalized, e.event_timestamp FROM events e
                    WHERE e.organization_id = $1 AND $4 = 'failure' AND $3::text IS NOT NULL
                      AND e.source_ip = $3 AND md5(e.source_ip) = md5($3::text)
                      AND e.ingestion_id = 'logs' AND e.processing_status = 'processed'
                      AND e.event_type = 'authentication' AND e.action = 'login' AND e.outcome = 'failure'
                      AND e.event_timestamp > $5::timestamptz AND e.event_timestamp <= $5::timestamptz + $6 * INTERVAL '1 minute'
                    ORDER BY e.event_timestamp, e.id LIMIT $7
                )
                SELECT id, normalized FROM (
                    SELECT id, normalized, event_timestamp FROM later_users
                    UNION ALL
                    SELECT id, normalized, event_timestamp FROM later_source_ip
                ) related ORDER BY event_timestamp, id`, [organizationId, event.userId, event.sourceIp, event.outcome, event.timestamp, windowMinutes, AUTH_CORRELATION_RECHECK_LIMIT])
            for (const row of later.rows) work.push({ id: row.id, complete: false, findings: [], event: normalizeEvent(row.normalized, { vendor: 'Hanasand', product: 'Logs' }) })
        }
    }
    // Events are persisted together before correlation, then checked in event-time order.
    work.sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp))
    await persistEventFindings(work.flatMap(item => item.findings))
    for (const { id, event } of work) {
        if (event.eventType === 'authentication') await createFindings(organizationId, id, event, rules)
    }
    const matches = await run('SELECT rule_id, severity, summary, evidence, event_ids FROM findings WHERE organization_id = $1 AND event_ids && $2::text[]', [organizationId, work.map(item => item.id)])
    const byEvent = new Map<string, typeof matches.rows>()
    for (const finding of matches.rows) for (const id of finding.event_ids) byEvent.set(id, [...(byEvent.get(id) || []), finding])
    const updates = work.map(({ id, event }) => {
        const detections = byEvent.get(id) || []
        let severity = String(event.normalized.severity)
        for (const finding of detections) if (severityOrder.indexOf(finding.severity) > severityOrder.indexOf(severity as typeof severityOrder[number])) severity = finding.severity
        return { id, result: { severity, detections, evaluated_at: new Date().toISOString(), rules_checked: rules.filter(rule => rule.enabled !== false).length } }
    })
    // A correlation may implicate earlier events that were already processed in
    // another batch. Refresh their evidence too so searches cannot leave them low.
    const relatedIds = [...byEvent.keys()].filter(id => !work.some(item => item.id === id))
    if (relatedIds.length) {
        const related = await run('SELECT id, normalized FROM events WHERE organization_id = $1 AND id = ANY($2::text[]) AND ingestion_id = \'logs\' AND processing_status = \'processed\'', [organizationId, relatedIds])
        for (const row of related.rows) {
            const detections = [...new Map([...(row.normalized.detections || []), ...(byEvent.get(row.id) || [])].map(finding => [`${finding.rule_id}:${[...finding.event_ids].sort().join(',')}`, finding])).values()]
            const severity = detections.reduce((value, finding) => severityOrder.indexOf(finding.severity) > severityOrder.indexOf(value) ? finding.severity : value, row.normalized.severity || 'low')
            updates.push({ id: row.id, result: { severity, detections, evaluated_at: row.normalized.evaluated_at, rules_checked: row.normalized.rules_checked } })
        }
    }
    await run(`UPDATE events e SET normalized = e.normalized || item.result, processing_status = 'processed'
        FROM jsonb_to_recordset($1::jsonb) AS item(id text, result jsonb) WHERE e.id = item.id
        AND (e.processing_status IS DISTINCT FROM 'processed' OR e.normalized IS DISTINCT FROM e.normalized || item.result)`, [JSON.stringify(updates)])
}

async function pruneLoginMonitorEvents(logs: LogInput[], organizationId: string, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    const candidates = logs.flatMap(log => String(log.id).startsWith('login_events:')
        ? [{ log, eventId: eventIdForLog(log), event: normalizeLogEvent(log, rules) }] : [])
    if (!candidates.length) return new Set<string>()
    const retention = await loadLogRetentionRules(organizationId)
    const matching = candidates.filter(item => customRetentionAction(item.event, retention) === 'drop')
    if (!matching.length) return new Set<string>()
    return withTransaction(async query => {
        await query('SET LOCAL lock_timeout=\'1ms\'')
        const existing = await query('SELECT id,normalized FROM events WHERE organization_id=$1 AND id=ANY($2::text[]) FOR UPDATE NOWAIT',
            [organizationId, matching.map(item => item.eventId)])
        const ids = existing.rows.map(row => row.id)
        const findings = ids.length ? await query('SELECT event_ids FROM findings WHERE event_ids && $1::text[]', [ids]) : { rows: [] as Array<{ event_ids: string[] }> }
        const protectedIds = new Set(findings.rows.flatMap(row => row.event_ids))
        const protectedEventIds = new Set(existing.rows.filter(row => protectedIds.has(row.id)
            || ['medium', 'high', 'critical'].includes(row.normalized?.severity) || row.normalized?.detections?.length).map(row => row.id))
        const safe = matching.filter(item => !protectedEventIds.has(item.eventId))
        if (!safe.length) return new Set<string>()
        const sourceIds = safe.map(item => String(item.log.id).slice('login_events:'.length))
        const removed = await query('DELETE FROM login_events WHERE id=ANY($1::bigint[]) AND status=\'success\' RETURNING id', [sourceIds])
        const removedIds = new Set(removed.rows.map(row => String(row.id)))
        const deleted = safe.filter(item => removedIds.has(String(item.log.id).slice('login_events:'.length)))
        for (const item of deleted) await recordCustomDropReceipts(item.event, retention, `service:${item.log.id}`, organizationId, query)
        if (deleted.length) await query('DELETE FROM events WHERE organization_id=$1 AND id=ANY($2::text[])', [organizationId, deleted.map(item => item.eventId)])
        return new Set(deleted.map(item => String(item.log.id)))
    })
}
