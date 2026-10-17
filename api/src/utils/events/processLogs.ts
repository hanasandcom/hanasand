import { readLogCatchupSettings } from './catchupLimit.ts'
import { refreshLogCatchupProgress } from './catchupProgress.ts'
import run, { withTransaction } from '#db'
import { createFindings } from '../../handlers/events/findingEngine.ts'
import { loadConfiguredRules } from '../../handlers/events/ruleStorage.ts'
import { normalizeEvent } from '../../handlers/events/eventNormalization.ts'
import { normalizeLogEvent, type LogInput } from './logEvent.ts'
import { processLog, processLogBatch } from './processLogBatch.ts'
import { processAdditionalLogSources } from './storedSources.ts'
import { backfillLogDimensions } from '../logs/dimensions.ts'

export { processLog, processLogBatch }

const DEDICATED_LOG_BATCH_LIMIT = 50
const DEDICATED_LOG_PAGE_CONCURRENCY = 36
const DEDICATED_LOG_FRESH_LIMIT = 150
const DEFAULT_LOG_PAGE_CONCURRENCY = 3
const AUTH_CORRELATION_PAGE_SIZE = 1

function mayBeAuthentication(log: LogInput) {
    const metadata = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata) ? log.metadata : {}
    const structured = metadata.structured && typeof metadata.structured === 'object' && !Array.isArray(metadata.structured)
        ? metadata.structured as Record<string, unknown> : {}
    return metadata.category === 'authentication'
        || String(metadata.event_type || structured.event_type || '').trim() === 'authentication'
        || /(?:Accepted|Failed) (?:password|publickey) for (?:invalid user )?\S+ from \S+/.test(log.message)
        || /(?:^|[-_])(ssh|sshd|auth|sudo)(?:[-_]|$)/i.test(log.service)
}

function requiresCorrelation(log: LogInput, rules: Awaited<ReturnType<typeof loadConfiguredRules>>) {
    if (!mayBeAuthentication(log)) return false
    // The event already has Hanasand's canonical type and action here. Avoid
    // building and redacting a second normalized copy just to choose its lane.
    const event = normalizeLogEvent(log, rules)
    return event.event_type.trim() === 'authentication' && event.action.trim() === 'login'
}

function scopedProcessor(platformId: string, onWork: () => void, afterBatch?: () => Promise<void>) {
    const configured = new Map<string, Awaited<ReturnType<typeof loadConfiguredRules>>>()
    const processScopes = async (logs: LogInput[], priority = false) => {
        if (logs.length) onWork()
        const scopes = new Map<string, LogInput[]>()
        for (const row of logs) {
            const scope = String(row.metadata?.organizationId || row.metadata?.tenantId || platformId)
            if (!scopes.has(scope)) scopes.set(scope, [])
            scopes.get(scope)!.push(row)
        }
        for (const [scope, batch] of scopes) {
            const active = await run('SELECT id FROM organizations WHERE id = $1 AND status = \'active\'', [scope])
            const target = active.rows.length ? scope : platformId
            if (!configured.has(target)) configured.set(target, await loadConfiguredRules(target))
            // Keep fresh work small for latency; larger durable pages reduce write overhead.
            // Recovery still yields to fresh arrivals after every durable page.
            const pageSize = process.env.LOG_PROCESSOR_ONLY === '1'
                ? DEDICATED_LOG_BATCH_LIMIT
                : priority ? 200 : 400
            const pageConcurrency = process.env.LOG_PROCESSOR_ONLY === '1'
                ? DEDICATED_LOG_PAGE_CONCURRENCY
                : DEFAULT_LOG_PAGE_CONCURRENCY
            const processPage = (page: LogInput[]) => processLogBatch(page, target, configured.get(target)!)
            const processPages = async (logs: LogInput[], independent: boolean) => {
                // Keep correlation pages small, but let unrelated identities
                // progress together. Receipt and finding writes are idempotent.
                const batchSize = independent ? pageSize : Math.min(pageSize, AUTH_CORRELATION_PAGE_SIZE)
                const pages = Array.from({ length: Math.ceil(logs.length / batchSize) }, (_, index) => logs.slice(index * batchSize, (index + 1) * batchSize))
                // The dedicated worker can use its reserved pool for thirty-six
                // bounded pages; API workers retain their smaller group.
                for (let offset = 0; offset < pages.length; offset += pageConcurrency) {
                    const group = pages.slice(offset, offset + pageConcurrency)
                    if (group.length === 1) {
                        await processPage(group[0])
                        await afterBatch?.()
                        continue
                    }
                    const work = group.map(processPage)
                    let firstError: unknown
                    try { await Promise.race(work) } catch (error) { firstError = error }
                    let freshError: unknown
                    if (!firstError) {
                        try { await afterBatch?.() } catch (error) { freshError = error }
                    }
                    const results = await Promise.allSettled(work)
                    const workError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
                    if (workError) throw workError.reason
                    if (freshError) throw freshError
                }
            }

            // Only login events use shared event-time correlation state. Keep
            // those serialized; fresh stateless logs must not hold the global
            // correlation lock while their findings are evaluated and written.
            const independentLogs: LogInput[] = [], correlationLogs: LogInput[] = []
            for (const log of batch) {
                (requiresCorrelation(log, configured.get(target)!) ? correlationLogs : independentLogs).push(log)
            }
            if (priority) {
                // Preserve the latency-sensitive login lane, then let ordinary
                // fresh records use the same bounded parallel path as history.
                await processPages(correlationLogs, false)
                await processPages(independentLogs, true)
            } else {
                // Fresh arrivals can run between durable independent pages.
                await processPages(independentLogs, true)
                await processPages(correlationLogs, false)
            }
        }
    }
    return { configured, processScopes }
}

export async function processLiveLogs() {
    return withTransaction(async query => {
        await query('SET LOCAL lock_timeout=\'1ms\'')
        const logs = await pendingLogEvents(DEDICATED_LOG_FRESH_LIMIT, 10_000, query)
        if (!logs.length) return false
        const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
        if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
        await scopedProcessor(platform.rows[0].id, () => {}).processScopes(logs, true)
        return true
    })
}

async function pendingLogEvents(limit: number, recentMs = 0, query = run): Promise<LogInput[]> {
    const recent = recentMs ? 'AND e.received_at >= statement_timestamp() - ($2 * INTERVAL \'1 millisecond\')' : ''
    const params = recentMs ? [limit, recentMs] : [limit]
    const rows = await query(`SELECT e.id, e.event_timestamp, e.normalized FROM events e
        WHERE e.ingestion_id='logs' AND e.processing_status='pending' ${recent}
        ORDER BY e.received_at, e.id LIMIT $1`, params)
    return rows.rows.map(row => ({
        id: row.id, eventId: row.id, service: String(row.normalized?.service || 'hanasand-api'),
        host: String(row.normalized?.host || ''), level: String(row.normalized?.level || 'info'),
        message: String(row.normalized?.message || ''), created_at: row.normalized?.timestamp || row.event_timestamp,
        metadata: row.normalized?.metadata && typeof row.normalized.metadata === 'object' ? row.normalized.metadata : {},
        ...(typeof row.normalized?.source_event_id === 'string' ? { source_event_id: row.normalized.source_event_id } : {}),
    }))
}

export async function processStoredLogs() {
    const settings = readLogCatchupSettings()
    const dedicatedWorker = process.env.LOG_PROCESSOR_ONLY === '1'
    const limit = dedicatedWorker ? Math.min(settings.limit, DEDICATED_LOG_BATCH_LIMIT * DEDICATED_LOG_PAGE_CONCURRENCY) : Math.min(settings.limit, 1000)
    let didWork = false
    await withTransaction(async query => {
        await query('SET LOCAL lock_timeout=\'1ms\'')
        didWork = true
        const platform = await run('SELECT id FROM organizations WHERE status = \'active\' AND (id = $1 OR ($1::text IS NULL AND lower(name) = \'hanasand\')) ORDER BY created_at LIMIT 1', [process.env.PLATFORM_LOG_ORGANIZATION_ID || null])
        if (!platform.rows[0]) throw new Error('Configure an active platform log organization.')
        const { configured, processScopes } = scopedProcessor(platform.rows[0].id, () => { })
        const pendingLogs = await pendingLogEvents(limit, 0, query)
        await processScopes(pendingLogs, true)
        await processAdditionalLogSources(processScopes, Math.min(settings.historyLimit, 10_000), Math.min(settings.limit, 1000), query)
        const pending = await query(`SELECT e.* FROM events e JOIN organizations o ON o.id = e.organization_id
            WHERE e.ingestion_id <> 'logs' AND e.processing_status = 'pending' AND o.status = 'active'
            ORDER BY e.event_timestamp, e.id LIMIT $1`, [dedicatedWorker ? limit : 100])
        for (const row of pending.rows) {
            didWork = true
            if (!configured.has(row.organization_id)) configured.set(row.organization_id, await loadConfiguredRules(row.organization_id))
            await createFindings(row.organization_id, row.id, normalizeEvent(row.normalized, { vendor: row.source_vendor, product: row.source_product }), configured.get(row.organization_id)!)
            await run('UPDATE events SET processing_status = \'processed\' WHERE id = $1 AND organization_id = $2', [row.id, row.organization_id])
        }
    })
    void refreshLogCatchupProgress()
    void backfillLogDimensions().catch(() => {})
    return didWork
}
