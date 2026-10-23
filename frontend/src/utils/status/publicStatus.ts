import meaningfulIncidentUpdates from './incidentUpdates'
import { publicStatusLabel, publicStatusMessage } from './publicStatusCopy'
import { ServiceCheck, ServiceStatus } from './getStatus'

const requiredPublicChecks = [
    { service: 'core', check_name: 'API health' },
    { service: 'website', check_name: 'Public website' },
    { service: 'threat-intelligence', check_name: 'Public search' },
    { service: 'threat-intelligence', check_name: 'Processing backlog' },
    { service: 'threat-intelligence', check_name: 'Source collection' },
    { service: 'dark-web-monitoring', check_name: 'Monitoring workspace' },
    { service: 'dark-web-monitoring', check_name: 'Latest activity' },
] as const

export const MAX_CHECK_AGE_MS = 5 * 60 * 1000

export function toPublicServiceStatus(status: ServiceStatus, nowMs = Date.now()): ServiceStatus {
    const allChecks = new Map(status.checks.map(check => [checkKey(check), check]))
    const currentChecks = new Map(status.checks
        .filter(check => isCurrentPublicCheck(check, nowMs) && status.monitoring !== 'unavailable')
        .map(check => [checkKey(check), check]))
    const publicCheckKeys = new Set(requiredPublicChecks.map(checkKey))
    const checks = requiredPublicChecks.map(required => {
        const check = currentChecks.get(checkKey(required))
        if (check) return toPublicServiceCheck(check)
        const previous = allChecks.get(checkKey(required))
        return previous ? toPublicServiceCheck(previous) : missingPublicCheck(required)
    })

    const evidenceTimes = requiredPublicChecks.map(required => Date.parse(allChecks.get(checkKey(required))?.checked_at || ''))
    const lastVerifiedAt = evidenceTimes.every(Number.isFinite) ? new Date(Math.min(...evidenceTimes)).toISOString() : status.last_verified_at
    return {
        overall: publicOverall(status.checks.filter(check => isCurrentPublicCheck(check, nowMs)), status.monitoring, status.overall),
        monitoring: status.monitoring === 'live' || status.monitoring === undefined
            && requiredPublicChecks.every(required => currentChecks.has(checkKey(required))) ? 'live' : 'unavailable',
        last_verified_at: lastVerifiedAt,
        history_available: status.history_available,
        history_generated_at: status.history_generated_at,
        generated_at: status.generated_at,
        checks,
        history: status.history.filter(row => publicCheckKeys.has(checkKey(row))).map(row => ({
            ...row,
            service: publicStatusLabel(row.service),
            check_name: publicStatusLabel(row.check_name),
        })),
        incidents: status.incidents.filter(incident => publicCheckKeys.has(checkKey(incident))).map(incident => ({
            ...incident,
            service: publicStatusLabel(incident.service),
            check_name: publicStatusLabel(incident.check_name),
            title: publicStatusLabel(incident.title),
            summary: publicStatusMessage(incident.summary) || incident.summary,
            cause: publicStatusMessage(incident.cause) || incident.cause,
            updates: meaningfulIncidentUpdates(incident.updates.map(update => ({
                ...update,
                message: publicStatusMessage(update.message) || update.message,
                evidence: update.evidence ? publicStatusMessage(update.evidence) || update.evidence : undefined,
            }))),
        })),
    }
}

function checkKey(value: { service: string, check_name: string }) {
    return `${value.service}\n${value.check_name}`
}

function publicOverall(sourceChecks: ServiceCheck[], monitoring: ServiceStatus['monitoring'] | undefined, reported: ServiceStatus['overall']): ServiceStatus['overall'] {
    const statusFor = (names: string[]) => sourceChecks.find(check => names.some(name => check.check_name.toLowerCase() === name.toLowerCase()))?.status
    const anchors = [statusFor(['API', 'API health']), statusFor(['Website', 'Public website']), statusFor(['Authentication', 'Identity'])]
    if (anchors.every(status => status === 'down')) return 'down'
    if (sourceChecks.some(check => check.status === 'down' || check.status === 'degraded')) return 'degraded'
    if (!sourceChecks.length) return reported === 'up' || reported === 'degraded' || reported === 'down' ? reported : 'unknown'
    if (monitoring !== 'live' && monitoring !== undefined) return 'unknown'
    return 'up'
}

function missingPublicCheck(required: typeof requiredPublicChecks[number]): ServiceCheck {
    return {
        service: publicStatusLabel(required.service),
        check_name: publicStatusLabel(required.check_name),
        status: 'unknown',
        latency_ms: 0,
        message: 'No status result has arrived in the last 5 minutes. Treat this component as unverified.',
        checked_at: '',
        uptime_30d: 'unverified',
    }
}

export function isCurrentPublicCheck(check: ServiceCheck, nowMs: number) {
    const checkedAt = new Date(check.checked_at).getTime()
    if (!Number.isFinite(checkedAt)) {
        return false
    }

    const age = nowMs - checkedAt
    return age >= -60_000 && age <= MAX_CHECK_AGE_MS
}

function toPublicServiceCheck(check: ServiceCheck): ServiceCheck {
    return {
        ...check,
        service: publicStatusLabel(check.service),
        check_name: publicStatusLabel(check.check_name),
        message: publicStatusMessage(check.message),
    }
}

// The browser and server use the same evidence rule. Polling cannot turn an
// empty or stale response into a verified snapshot.
export function isVerifiedStatus(status: ServiceStatus, now = Date.now()) {
    return status.monitoring !== 'unavailable' && status.checks.length === requiredPublicChecks.length
        && requiredPublicChecks.every(required => status.checks.some(check => check.service === publicStatusLabel(required.service) && check.check_name === publicStatusLabel(required.check_name) && ['up', 'degraded', 'down'].includes(check.status) && isCurrentPublicCheck(check, now)))
}

export function retainVerifiedStatus(next: ServiceStatus, previous?: ServiceStatus): ServiceStatus {
    if (!previous) return next
    const checks = next.checks.map(check => {
        const last = previous.checks.find(row => row.service === check.service && row.check_name === check.check_name)
        if (check.status === 'unknown') return last || check
        return last && Date.parse(last.checked_at) > Date.parse(check.checked_at) ? last : check
    })
    const retained = checks.length ? checks : previous.checks
    const overall = next.monitoring === 'live' || next.monitoring === undefined ? next.overall : previous.overall
    return { ...next, overall, checks: retained,
        history: next.history.length ? next.history : previous.history,
        incidents: next.incidents.length ? next.incidents : previous.incidents,
        last_verified_at: retained.every(check => Number.isFinite(Date.parse(check.checked_at))) ? new Date(Math.min(...retained.map(check => Date.parse(check.checked_at)))).toISOString() : previous.last_verified_at,
        monitoring: next.monitoring === 'unavailable' ? 'unavailable' : 'live' }
}


// Store enough history for an offline refresh without overflowing browser storage
// when an older server or the incident page supplies full incident timelines.
export function compactStatusSnapshot(status: ServiceStatus): ServiceStatus {
    const ids = new Set(status.history.flatMap(day => day.incident_ids.slice(0, 1)))
    for (const incident of status.incidents.slice(0, 25)) ids.add(incident.id)
    return {
        ...status,
        history: status.history.map(day => ({ ...day, incident_ids: day.incident_ids.slice(0, 1) })),
        incidents: status.incidents.filter(incident => ids.has(incident.id)).map(incident => ({ ...incident, updates: [] })),
    }
}
