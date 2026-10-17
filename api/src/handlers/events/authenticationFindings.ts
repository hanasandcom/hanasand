import run from '#db'
import { matchesRule } from '#utils/events/conditions.ts'
import { defaultRuleDefinition } from './ruleCatalog.ts'
import { deviceIdFor, object } from './shared.ts'
import type { Event, FindingInput, NormalizedEvent, Rule } from './types.ts'

export async function collectAuthFindings(organizationId: string, eventId: string, event: NormalizedEvent, rules: Rule[], enabled: Set<string>, prepareFinding: (org: string, id: string, severity: string, summary: string, eventIds: string[], evidence: Event) => FindingInput): Promise<FindingInput[]> {
    const findings: FindingInput[] = []
    const insertFinding = (org: string, id: string, severity: string, summary: string, eventIds: string[], evidence: Event) => {
        findings.push(prepareFinding(org, id, severity, summary, eventIds, evidence))
    }
    const parameters = (id: string) => rules.find(rule => rule.id === id)?.definition?.parameters || defaultRuleDefinition(id).parameters!
    if (event.eventType !== 'authentication' || event.action !== 'login') return findings
    const brute = rules.find(rule => rule.id === 'auth.brute_force_success.v1')
    if (enabled.has('auth.brute_force_success.v1') && event.userId && event.outcome === 'success') {
        const { windowMinutes, minimumCount } = parameters('auth.brute_force_success.v1')
        // Query the actual window, rather than truncating to the last 30 events.
        const failures = await run(`SELECT id, normalized FROM events
            WHERE organization_id = $1 AND user_id = $2 AND id <> $3
              AND event_type = 'authentication' AND action = 'login' AND outcome = 'failure'
              AND event_timestamp BETWEEN ($4::timestamptz - $5 * INTERVAL '1 minute') AND $4::timestamptz
            ORDER BY event_timestamp DESC, id`, [organizationId, event.userId, eventId, event.timestamp, windowMinutes])
        const matching = failures.rows.filter((row: { normalized: Event }) => matchesRule(row.normalized, brute?.definition?.failureConditions || []))
        if (matching.length >= minimumCount) {
            const failedEventIds = matching.slice(0, minimumCount).map((row: { id: string }) => row.id)
            insertFinding(organizationId, 'auth.brute_force_success.v1', 'high', 'Successful login after repeated failures', [eventId, ...failedEventIds], { successfulEventId: eventId, failedEventIds, windowMinutes, minimumCount, matchedCount: matching.length })
        }
    }
    const historyRules = ['auth.new_country.v1', 'auth.new_device.v1', 'auth.impossible_travel.v1'].filter(id => enabled.has(id))
    let rows: Array<{ id: string, event_timestamp: string, outcome: string, source_country: string | null, normalized: Event }> = []
    if (event.userId && historyRules.length) {
        const historyLimit = Math.max(...historyRules.map(id => parameters(id).historyLimit))
        const previous = await run(`
            SELECT id, event_timestamp, outcome, source_country, normalized
            FROM events
            WHERE organization_id = $1 AND user_id = $2 AND id <> $3
              AND event_type = 'authentication' AND action = 'login' AND event_timestamp <= $4::timestamptz
            ORDER BY event_timestamp DESC
            LIMIT $5
        `, [organizationId, event.userId, eventId, event.timestamp, historyLimit])
        rows = previous.rows as typeof rows
    }
    if (enabled.has('auth.password_spray.v1') && event.outcome === 'failure' && event.sourceIp) {
        const { windowMinutes, minimumCount } = parameters('auth.password_spray.v1')
        // Bound imported source text in the index; exact equality remains authoritative.
        const spray = await run(`
            SELECT id, user_id, event_timestamp, normalized
            FROM events
            WHERE organization_id = $1 AND source_ip = $2 AND outcome = 'failure' AND id <> $3
              AND md5(source_ip) = md5($2::text)
              AND event_type = 'authentication' AND action = 'login'
              AND event_timestamp BETWEEN ($4::timestamptz - $5 * INTERVAL '1 minute') AND $4::timestamptz
            ORDER BY event_timestamp DESC
        `, [organizationId, event.sourceIp, eventId, event.timestamp, windowMinutes])
        const sprayRows = (spray.rows as Array<{ id: string, user_id: string | null, normalized: Event }>).filter(row => matchesRule(row.normalized, rules.find(rule => rule.id === 'auth.password_spray.v1')?.definition?.conditions || []))
        const targetUsers = Array.from(new Set([event.userId, ...sprayRows.map(row => row.user_id)].filter(Boolean)))
        if (targetUsers.length >= minimumCount) {
            insertFinding(organizationId, 'auth.password_spray.v1', 'high', 'Failed logins for multiple users from one source', [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], { sourceIp: event.sourceIp, userIds: targetUsers, failedEventIds: [eventId, ...sprayRows.slice(0, 10).map(row => row.id)], windowMinutes, minimumCount })
        }
    }
    if (!event.userId || event.outcome !== 'success') return findings
    const countryHistory = rows.slice(0, parameters('auth.new_country.v1').historyLimit).filter(row => row.outcome === 'success' && row.source_country)
    const priorSuccess = event.sourceCountry && !countryHistory.some(row => row.source_country === event.sourceCountry) ? countryHistory[0] : undefined
    if (enabled.has('auth.new_country.v1') && priorSuccess) {
        insertFinding(organizationId, 'auth.new_country.v1', 'medium', `Login from new country: ${event.sourceCountry}`, [eventId, priorSuccess.id], { currentCountry: event.sourceCountry, previousCountry: priorSuccess.source_country })
    }
    const currentDevice = event.deviceId
    const deviceHistory = rows.slice(0, parameters('auth.new_device.v1').historyLimit).filter(row => row.outcome === 'success' && deviceIdFor(row.normalized))
    const priorDevice = currentDevice && !deviceHistory.some(row => deviceIdFor(row.normalized) === currentDevice) ? deviceHistory[0] : undefined
    if (enabled.has('auth.new_device.v1') && priorDevice) {
        insertFinding(organizationId, 'auth.new_device.v1', 'medium', 'Successful login from a new device', [eventId, priorDevice.id], { currentDevice, previousDevice: deviceIdFor(priorDevice.normalized) })
    }
    const coordinates = coordinatesFor(event.normalized)
    const priorCoordinates = rows.slice(0, parameters('auth.impossible_travel.v1').historyLimit).map(row => ({ row, coordinates: coordinatesFor(row.normalized) })).find(item => item.row.outcome === 'success' && item.coordinates && coordinates)
    if (enabled.has('auth.impossible_travel.v1') && priorCoordinates && coordinates) {
        const minutes = Math.abs(Date.parse(event.timestamp) - Date.parse(priorCoordinates.row.event_timestamp)) / 60_000
        const distanceKm = distance(coordinates, priorCoordinates.coordinates!)
        if (minutes < parameters('auth.impossible_travel.v1').windowMinutes && distanceKm > parameters('auth.impossible_travel.v1').distanceKm) {
            insertFinding(organizationId, 'auth.impossible_travel.v1', 'high', 'Successful logins from geographically incompatible locations', [eventId, priorCoordinates.row.id], { current: coordinates, previous: priorCoordinates.coordinates, distanceKm: Math.round(distanceKm), elapsedMinutes: Math.round(minutes) })
        }
    }
    return findings
}

function coordinatesFor(event: Event) {
    const source = object(event.source)
    const coordinates = object(source.coordinates)
    const lat = Number(coordinates.latitude ?? source.latitude)
    const lon = Number(coordinates.longitude ?? source.longitude)
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
}
function distance(a: { lat: number, lon: number }, b: { lat: number, lon: number }) {
    const radius = 6371
    const radians = (value: number) => value * Math.PI / 180
    const dLat = radians(b.lat - a.lat)
    const dLon = radians(b.lon - a.lon)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
    return 2 * radius * Math.asin(Math.sqrt(h))
}
