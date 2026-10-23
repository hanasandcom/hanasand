import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { ensureStatusSnapshots } from '#utils/status/snapshotSchema.ts'
import { createDashboardSerializer, searchHealth } from '#utils/status/presentation.ts'
import { calculateOverallStatus, loadStatusPayload, isCurrentCheck, time, toPublicMonitorRow, type MonitorRow } from '#utils/status/loadPayload.ts'

export { buildStatusIncidents as buildIncidents } from '#utils/status/incidentHistory.ts'

const STATUS_CACHE_MS = 15_000
const MONITOR_STALE_MS = 5 * 60 * 1000
let statusCache: Awaited<ReturnType<typeof loadStatusPayload>> | null = null
let expiresAt = 0
let statusInflight: Promise<Awaited<ReturnType<typeof loadStatusPayload>>> | null = null
let historyRefresh: Promise<void> | null = null
let historyLoad: Promise<void> | null = null
let historyRetryAt = 0
let dashboardCache: { current: unknown, history: unknown, json: string } | undefined
const serializeDashboard = createDashboardSerializer()
let historySnapshot: Awaited<ReturnType<typeof loadStatusPayload>> | null = null

export default async function getStatus(req: FastifyRequest<{ Querystring: { summary?: string, incident?: string, dashboard?: string, check?: string } }>, res: FastifyReply) {
    res.header('Cache-Control', 'no-store')
    const check = req.query?.check
    if (check && check !== 'public-search') return res.status(404).send({ error: 'Unknown status check.' })
    const payload = await statusPayload(!req.query?.incident && (req.query?.summary === 'true' || Boolean(req.query?.check)))
    if (check) {
        const health = searchHealth(payload as { checks: MonitorRow[] })
        return res.status(health.ok ? 200 : 503).send(health)
    }
    if (req.query?.dashboard === 'true') {
        if (dashboardCache?.current !== statusCache || dashboardCache?.history !== historySnapshot) {
            dashboardCache = { current: statusCache, history: historySnapshot, json: serializeDashboard(payload as ReturnType<typeof withHistory>) }
        }
        return res.type('application/json').send(dashboardCache!.json)
    }
    if (!req.query?.incident) return res.send(payload)
    const selected = selectStatusIncident(payload as ReturnType<typeof withHistory>, req.query.incident)
    if (selected.history_available) return res.send(selected)
    // On a fresh replica, read only this report from the persisted snapshot;
    // do not wait for the background 90-day history rebuild.
    const saved = await run(`
        SELECT payload->>'generated_at' AS generated_at,
            (SELECT COALESCE(jsonb_agg(incident), '[]'::jsonb)
             FROM jsonb_array_elements(payload->'incidents') incident
             WHERE incident->>'id' = $1 OR incident->'aliases' ? $1) AS incidents
        FROM service_status_snapshots WHERE id = 'history-v2'
    `, [req.query.incident])
    if (!saved.rows.length) return res.status(503).send({ error: 'Incident history is temporarily unavailable.' })
    return res.send({ ...selected, ...saved.rows[0], history_available: true })
}

export function selectStatusIncident<T extends { checks: unknown[], history: unknown[], incidents: { id: string, aliases?: string[] }[] }>(payload: T, id: string) {
    return { ...payload, checks: [], history: [], incidents: payload.incidents.filter(incident => incident.id === id || incident.aliases?.includes(id)) }
}

async function statusPayload(summary: boolean) {
    // Recovery instances only read snapshots maintained by the primary.
    if (process.env.RECOVERY_ESSENTIAL_ONLY !== '1') await ensureStatusSnapshots()
    if (!summary) {
        refreshHistory()
        // A new or idle replica must load the saved history before answering.
        // The expensive rebuild still runs in the background.
        if (!historySnapshot || Date.now() - Date.parse(historySnapshot.generated_at) >= MONITOR_STALE_MS) await historyLoad?.catch(() => {})
    }
    if (statusCache && expiresAt > Date.now()) {
        return withCanonicalMonitorFallback(summary ? withPublicChecks(statusCache) : withHistory(statusCache))
    }
    statusInflight ||= loadStatusPayload(true).then(payload => {
        statusCache = payload.checks.length ? payload : { ...(statusCache || historySnapshot || payload), monitoring: 'unavailable' }
        expiresAt = Date.now() + STATUS_CACHE_MS
        prepareDashboard()
        return statusCache
    }).catch(error => {
        console.error('[production-monitor] current status unavailable:', error.message)
        expiresAt = Date.now() + STATUS_CACHE_MS
        if (statusCache) {
            statusCache = { ...statusCache, monitoring: 'unavailable' }
            prepareDashboard()
        }
        return statusCache || { ...(historySnapshot || { overall: 'unknown', generated_at: '', checks: [], history: [], incidents: [] }), monitoring: 'unavailable' }
    }).finally(() => { statusInflight = null })
    // A slow database refresh must not delay readers that already have evidence.
    const current = statusCache && statusCache.monitoring === 'live'
        && Date.now() - Date.parse(statusCache.generated_at) < MONITOR_STALE_MS ? statusCache : await statusInflight
    return withCanonicalMonitorFallback(summary ? withPublicChecks(current) : withHistory(current))
}

async function withCanonicalMonitorFallback<T extends { checks?: MonitorRow[], monitoring?: string }>(payload: T) {
    if (payload.checks?.length) return payload
    const feedUrl = process.env.PUBLIC_STATUS_FEED_URL || 'https://status.hanasand.com/api/status'
    try {
        const response = await fetch(feedUrl, { cache: 'no-store', signal: AbortSignal.timeout(2500) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const feed = await response.json() as {
            overall?: string
            monitoring?: string
            generated_at?: string
            checks?: MonitorRow[]
            history?: unknown[]
            incidents?: unknown[]
            history_available?: boolean
        }
        const checks = Array.isArray(feed.checks) ? feed.checks.filter(check => check && check.service && check.check_name
            && ['up', 'degraded', 'down', 'unknown'].includes(check.status)) : []
        if (!checks.length || !checks.some(check => check.status !== 'unknown')) return payload
        return {
            ...payload,
            overall: calculateOverallStatus(checks),
            monitoring: feed.monitoring || 'unavailable',
            generated_at: feed.generated_at || payload.generated_at,
            checks,
            history: feed.history || (payload as { history?: unknown[] }).history || [],
            incidents: feed.incidents || (payload as { incidents?: unknown[] }).incidents || [],
            history_available: feed.history_available ?? (payload as { history_available?: boolean }).history_available,
        }
    } catch (error) {
        console.error('[production-monitor] canonical public status feed unavailable:', error instanceof Error ? error.message : String(error))
        return payload
    }
}

function prepareDashboard() {
    if (statusCache) dashboardCache = {
        current: statusCache,
        history: historySnapshot,
        json: serializeDashboard(withHistory(statusCache)),
    }
}

function withHistory(current: object) {
    const snapshot = historySnapshot
    const received = (current as { checks: MonitorRow[] }).checks
    const cutoff = Date.now() - MONITOR_STALE_MS
    // A history snapshot can outlive a monitor rename or a failed refresh. Do
    // not reintroduce an old check into the live banner after the current
    // five-minute freshness window has expired.
    const retained = snapshot?.checks.filter(old => time(old.checked_at) >= cutoff
        && !received.some(check => check.service === old.service && check.check_name === old.check_name)) || []
    const checks = [...received, ...retained].filter(isCurrentCheck).map(check => ({
        ...check,
        uptime_30d: snapshot?.checks.find(row => row.service === check.service && row.check_name === check.check_name)?.uptime_30d || 'unverified',
    }))
    return withPublicChecks({ ...current, ...(!received.length ? { monitoring: 'unavailable' } : {}), checks, history: snapshot?.history || [], incidents: snapshot?.incidents || [], history_generated_at: snapshot?.generated_at || '', history_available: Boolean(snapshot) })
}

function withPublicChecks<T extends { checks: MonitorRow[] }>(payload: T) {
    return { ...payload, checks: payload.checks.map(toPublicMonitorRow) }
}

function refreshHistory() {
    if (historyRefresh || Date.now() < historyRetryAt) return
    historyRetryAt = Date.now() + MONITOR_STALE_MS
    let savedIsFresh = false
    historyLoad = (async () => {
        const saved = await run('SELECT payload, updated_at FROM service_status_snapshots WHERE id = \'history-v2\'')
        if (saved.rows[0]) {
            historySnapshot = saved.rows[0].payload
            if (!statusCache && historySnapshot) statusCache = { ...historySnapshot, history: [], incidents: [] }
            prepareDashboard()
            savedIsFresh = Date.now() - new Date(saved.rows[0].updated_at).getTime() < MONITOR_STALE_MS
        }
    })()
    historyRefresh = historyLoad.then(async () => {
        if (savedIsFresh || process.env.RECOVERY_ESSENTIAL_ONLY === '1') return
        // History scans never block current checks. A database lock shares one
        // refresh across API instances; the persisted snapshot survives restarts.
        await withTransaction(async query => {
            const lock = await query('SELECT pg_try_advisory_xact_lock(hashtextextended(\'service-status-history\', 0)) AS acquired')
            if (!lock.rows[0].acquired) return
            await query('SET LOCAL statement_timeout = \'60s\'')
            const payload = await loadStatusPayload(false, query)
            if (!payload.checks.length) throw new Error('No current monitor results; retaining the verified snapshot.')
            await query('INSERT INTO service_status_snapshots (id, payload) VALUES (\'history-v2\', $1::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()', [JSON.stringify(payload)])
            historySnapshot = payload
            prepareDashboard()
        })
    }).catch(error => {
        historyRetryAt = Date.now() + STATUS_CACHE_MS
        console.error('[production-monitor] status history unavailable:', error.message)
    }).finally(() => { historyRefresh = null; historyLoad = null })
}
