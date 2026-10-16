import type { ServiceIncident, ServiceStatus } from '@/utils/status/getStatus'
import { formatDate, UPTIME_DAYS } from './statusFormatting'

type Check = ServiceStatus['checks'][number]

export function historyDaysFor(status: ServiceStatus, check: Check) {
    const incidentsById = new Map(status.incidents.map(incident => [incident.id, incident]))
    const rowsByDate = new Map(status.history.filter(row => row.service === check.service && row.check_name === check.check_name).map(row => [row.date, row]))

    return lastDays().map(date => {
        const row = rowsByDate.get(date)
        const incident = row?.incident_ids.map(id => incidentsById.get(id)).find(Boolean) || null
        const rowStatus = row?.status || 'unknown'
        const healthy = (row?.healthy_samples || 0) / (row?.samples || 1) * 100
        const healthyAndDegraded = ((row?.healthy_samples || 0) + (row?.degraded_samples || 0)) / (row?.samples || 1) * 100
        return {
            date,
            displayStatus: dayDisplayStatus(rowStatus, incident),
            incident,
            description: row?.samples ? `${formatDate(date)}: ${healthy.toFixed(2)}% operational across ${row.samples} checks. ${row.failed_samples || 0} failed; ${row.degraded_samples || 0} degraded.` : `${formatDate(date)}: ${rowStatus === 'unknown' ? 'No verified history' : rowStatus === 'up' ? 'Operational' : incident?.summary || rowStatus}`,
            style: row?.samples ? { background: `linear-gradient(to top, var(--ui-success) 0% ${healthy}%, var(--ui-warning) ${healthy}% ${healthyAndDegraded}%, var(--ui-danger) ${healthyAndDegraded}% 100%)` } : undefined,
        }
    })
}

function dayDisplayStatus(status: Check['status'], incident: ServiceIncident | null): Check['status'] {
    if (status !== 'down') return status
    return incident?.impact === 'Outage' ? 'down' : 'degraded'
}

function lastDays(count = UPTIME_DAYS) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(today)
        date.setUTCDate(today.getUTCDate() - (count - 1 - index))
        return date.toISOString().slice(0, 10)
    })
}
