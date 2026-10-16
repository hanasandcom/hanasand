type HistoryRow = {
    service: string
    check_name: string
    date: string
    samples?: number
    healthy_samples?: number
    degraded_samples?: number
    failed_samples?: number
    status: 'up' | 'degraded' | 'down' | 'unknown'
}

type IncidentRow = {
    service: string
    check_name: string
    status: 'degraded' | 'down'
    previous_status?: string
    previous_checked_at?: string | Date
    next_status?: string
    next_checked_at?: string | Date
    next_message?: string | null
    message: string | null
    checked_at: string | Date
}

const MAX_INCIDENT_GAP_MS = 15 * 60 * 1000

export function buildStatusHistory(rows: HistoryRow[], incidents: ReturnType<typeof buildStatusIncidents>) {
    const incidentIdsByKey = new Map<string, string[]>()
    for (const incident of incidents) {
        for (const date of datesBetween(incident.started_at, incident.resolved_at || new Date().toISOString())) {
            const key = `${incident.service}\n${incident.check_name}\n${date}`
            incidentIdsByKey.set(key, [...(incidentIdsByKey.get(key) || []), incident.id])
        }
    }

    return rows.map(row => ({
        ...row,
        incident_ids: incidentIdsByKey.get(`${row.service}\n${row.check_name}\n${row.date}`) || [],
    }))
}

export function buildStatusIncidents(rows: IncidentRow[]) {
    const groups: IncidentRow[][] = []
    for (const row of rows) {
        const previous = groups.at(-1)?.at(-1)
        // Rows are compacted, so continuity comes from the preceding raw sample,
        // not the distance between the retained first and last observations.
        const continuous = previous && previous.service === row.service && previous.check_name === row.check_name
            && previous.next_status !== 'up' && row.previous_status !== 'up'
            && timestamp(row.checked_at) - timestamp(row.previous_checked_at || previous.checked_at) <= MAX_INCIDENT_GAP_MS
        if (continuous) groups.at(-1)!.push(row)
        else groups.push([row])
    }

    return groups.map(group => {
        const first = group[0]
        const last = group.at(-1)!
        const resolvedAt = last.next_status === 'up' && last.next_checked_at ? iso(last.next_checked_at) : null
        const outage = group.some(row => row.status === 'down')
        const summary = first.check_name.toLowerCase() === 'latest activity'
            ? 'Recent monitoring activity was delayed. The activity feed was not up to date.'
            : `${first.check_name} ${outage ? 'did not pass its availability check' : 'was operating outside its normal check limits'}.`
        const updates = group.filter((row, index) => index === 0 || index === group.length - 1
            || row.status !== group[index - 1].status || row.message !== group[index - 1].message).map((row, index) => ({
            at: iso(row.checked_at),
            status: index === 0 ? 'investigating' : 'monitoring',
            message: index === 0 ? 'Automated monitoring detected a problem with this component.'
                : row.status === 'down' ? 'The availability check was still failing.'
                    : 'The check was reporting degraded service. Recovery had not yet been confirmed.',
            evidence: row.message || 'No additional check details were recorded.',
        }))
        if (resolvedAt) updates.push({
            at: resolvedAt, status: 'resolved',
            message: 'A successful check confirmed recovery. This is the first recorded healthy result after the incident; no repair details were recorded.',
            evidence: last.next_message || 'The component passed its health check.',
        })
        const startedAt = iso(first.checked_at)
        return {
            id: slug(`${first.service}-${first.check_name}-${startedAt}`),
            aliases: group.filter((row, index) => index > 0 && timestamp(row.checked_at) - timestamp(group[index - 1].checked_at) > MAX_INCIDENT_GAP_MS)
                .map(row => slug(`${row.service}-${row.check_name}-${iso(row.checked_at)}`)),
            service: first.service, check_name: first.check_name,
            title: `${first.check_name} ${outage ? 'interruption' : 'instability'}`,
            impact: outage ? 'Outage' : 'Instability',
            status: resolvedAt ? 'resolved' as const : 'investigating' as const,
            started_at: startedAt, resolved_at: resolvedAt,
            summary,
            cause: 'No confirmed root cause was recorded. The monitoring results below describe the symptoms, not a verified explanation.',
            updates: updates.reverse(),
        }
    }).sort((left, right) => timestamp(right.started_at) - timestamp(left.started_at))
}

function datesBetween(startedAt: string, endedAt: string) {
    const dates: string[] = []
    const start = new Date(`${startedAt.slice(0, 10)}T00:00:00.000Z`)
    const end = new Date(`${endedAt.slice(0, 10)}T00:00:00.000Z`)
    for (const date = start; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        dates.push(date.toISOString().slice(0, 10))
    }
    return dates
}

function iso(value: string | Date) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function timestamp(value: string | Date | undefined) {
    if (!value) return 0
    return new Date(value).getTime()
}

function slug(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}
