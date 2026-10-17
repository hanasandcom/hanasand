import run from '#db'
import { buildStatusHistory, buildStatusIncidents } from './incidentHistory.ts'

export type MonitorRow = {
    service: string
    check_name: string
    status: 'up' | 'degraded' | 'down' | 'unknown'
    latency_ms: number
    message: string | null
    checked_at: string | Date
    uptime_30d: string
}

export async function loadStatusPayload(summary = false, query = run) {
    const tasks = [
        () => query(summary ? `
        SELECT payload->>'service' AS service, payload->>'check_name' AS check_name,
            payload->>'status' AS status, (payload->>'latency_ms')::int AS latency_ms,
            payload->>'message' AS message, payload->>'checked_at' AS checked_at,
            'unverified'::text AS uptime_30d
        FROM service_status_snapshots
        WHERE id LIKE 'check:%'
          AND (payload->>'checked_at')::timestamptz >= NOW() - INTERVAL '5 minutes'
          AND NOT (payload->>'service' = 'core' AND payload->>'check_name' = 'API index')
        ` : `
        WITH latest AS (
            SELECT DISTINCT ON (service, check_name)
                service, check_name, status, latency_ms, message, checked_at
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '5 minutes'
              AND NOT (service = 'core' AND check_name = 'API index')
              -- Alert delivery is event-driven. An old mail failure remains
              -- useful history, but must not hold the live status down forever.
              AND NOT (
                service = 'production-monitor'
                AND check_name = 'Alert delivery'
                AND checked_at < NOW() - INTERVAL '30 minutes'
              )
            ORDER BY service, check_name, checked_at DESC
        ),
        uptime AS (
            SELECT
                service,
                check_name,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE status = 'up')
                    / NULLIF(COUNT(*), 0),
                    2
                ) AS uptime_30d
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '90 days'
              AND NOT (service = 'core' AND check_name = 'API index')
            GROUP BY service, check_name
        )
        SELECT latest.*, COALESCE(uptime.uptime_30d, 0)::text AS uptime_30d
        FROM latest
        LEFT JOIN uptime USING (service, check_name)
        ORDER BY latest.service ASC, latest.check_name ASC
    `),
        () => summary ? Promise.resolve({ rows: [] }) : query(`
        SELECT
            service,
            check_name,
            checked_at::date::text AS date,
            COUNT(*)::int AS samples,
            COUNT(*) FILTER (WHERE status = 'up')::int AS healthy_samples,
            COUNT(*) FILTER (WHERE status = 'degraded')::int AS degraded_samples,
            COUNT(*) FILTER (WHERE status = 'down')::int AS failed_samples,
            CASE
                WHEN BOOL_OR(status = 'down') THEN 'down'
                WHEN BOOL_OR(status = 'degraded') THEN 'degraded'
                ELSE 'up'
            END AS status
        FROM service_monitor_results
        WHERE checked_at >= CURRENT_DATE - INTERVAL '89 days'
          AND NOT (service = 'core' AND check_name = 'API index')
        GROUP BY service, check_name, checked_at::date
        ORDER BY service ASC, check_name ASC, date ASC
    `),
        () => summary ? Promise.resolve({ rows: [] }) : query(`
        WITH sequenced AS (
            SELECT
                service,
                check_name,
                status,
                message,
                checked_at,
                LAG(status) OVER status_history_window AS previous_status,
                LAG(checked_at) OVER status_history_window AS previous_checked_at,
                LEAD(status) OVER status_history_window AS next_status,
                LEAD(checked_at) OVER status_history_window AS next_checked_at,
                LEAD(message) OVER status_history_window AS next_message
            FROM service_monitor_results
            WHERE checked_at >= NOW() - INTERVAL '90 days'
              AND NOT (service = 'core' AND check_name = 'API index')
            WINDOW status_history_window AS (PARTITION BY service, check_name ORDER BY checked_at)
        )
        SELECT service, check_name, status, message, checked_at,
            previous_status, previous_checked_at, next_status, next_checked_at, next_message
        FROM sequenced
        WHERE status IN ('down', 'degraded')
          AND (
            previous_status IS NULL
            OR previous_status = 'up'
            OR previous_status <> status
            OR previous_checked_at IS NULL
            OR checked_at - previous_checked_at > INTERVAL '15 minutes'
            OR next_status IS NULL
            OR next_status = 'up'
            OR next_status <> status
            OR next_checked_at IS NULL
            OR next_checked_at - checked_at > INTERVAL '15 minutes'
          )
        ORDER BY service ASC, check_name ASC, checked_at ASC
    `),
    ]
    const results = []
    for (const task of tasks) results.push(await task())
    const [result, historyResult, incidentResult] = results

    const rawChecks = (result.rows as MonitorRow[]).filter(isCurrentCheck)
    const checks = rawChecks
    const incidents = buildStatusIncidents(incidentResult.rows)
    const history = buildStatusHistory(historyResult.rows, incidents)
    const overall = !checks.length ? 'unknown' : checks.length && checks.every(check => check.status === 'up')
        ? 'up'
        : checks.some(check => check.status === 'down')
            ? 'down'
            : 'degraded'

    return {
        overall,
        monitoring: checks.length && checks.every(check => check.status !== 'unknown') ? 'live' : 'unavailable',
        generated_at: checks.length ? new Date(Math.max(...checks.map(check => time(check.checked_at)))).toISOString() : '',
        checks,
        history,
        incidents,
    }
}

export function toPublicMonitorRow(row: MonitorRow): MonitorRow {
    if (row.status !== 'up' || !row.message) {
        return row
    }

    return {
        ...row,
        message: normalTrafficMessage(row.message),
    }
}

function normalTrafficMessage(message: string) {
    if (/No share page (?:4xx\/5xx|availability) responses in the recent log window\./i.test(message)) {
        return 'Normal workspace link traffic baseline.'
    }
    if (/No (?:websocket|realtime delivery) failures in the recent log window\./i.test(message)) {
        return 'Normal realtime delivery traffic baseline.'
    }
    if (/No (?:terminal failures|workspace session issues) in the recent log window\./i.test(message)) {
        return 'Normal workspace session traffic baseline.'
    }
    if (/No (?:VM provisioning|workspace runtime) errors in the recent log window\./i.test(message)) {
        return 'Normal workspace runtime traffic baseline.'
    }

    return message
}

export function time(value: string | Date | undefined) {
    if (!value) return 0
    return new Date(value).getTime()
}

export function isCurrentCheck(check: { service: string, check_name: string }) {
    return !(check.service === 'auth' && ['User creation', 'Login', 'Delete account'].includes(check.check_name))
}
