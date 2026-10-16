import { describe, expect, test } from 'bun:test'
import type { ServiceIncident, ServiceStatus } from '../src/utils/status/getStatus'
import { historyDaysFor } from '../src/app/status/statusDashboard/statusHistory'

const check: ServiceStatus['checks'][number] = {
    service: 'Core platform', check_name: 'API Health', status: 'up', latency_ms: 20,
    message: null, checked_at: '', uptime_30d: '99.90',
}

function incident(id: string, impact: ServiceIncident['impact']): ServiceIncident {
    return {
        id, service: check.service, check_name: check.check_name, title: `Incident ${id}`, impact,
        status: 'resolved', started_at: '2026-10-01T00:00:00Z', resolved_at: '2026-10-01T00:01:00Z',
        summary: 'Check failure recorded.', cause: 'Unknown', updates: [],
    }
}

describe('public status history presentation data', () => {
    test('keeps 90 days, links recorded incidents, and classifies their impact', () => {
        const date = new Date()
        date.setUTCHours(0, 0, 0, 0)
        date.setUTCDate(date.getUTCDate() - 1)
        const day = date.toISOString().slice(0, 10)
        const outage = incident('outage-1', 'Outage')
        const result = historyDaysFor({
            overall: 'down', generated_at: '', checks: [check], incidents: [outage],
            history: [
                { service: check.service, check_name: check.check_name, date: day, status: 'down', incident_ids: [outage.id], samples: 10, healthy_samples: 5, degraded_samples: 1, failed_samples: 4 },
            ],
        }, check)

        expect(result).toHaveLength(90)
        expect(result.at(-2)).toMatchObject({ displayStatus: 'down', incident: outage, description: expect.stringContaining('10 checks') })
        expect(result.at(-1)).toMatchObject({ displayStatus: 'unknown', incident: null, description: expect.stringContaining('No verified history') })
    })

    test('presents unresolved outage days as down and instability days as degraded', () => {
        const date = new Date()
        date.setUTCHours(0, 0, 0, 0)
        date.setUTCDate(date.getUTCDate() - 2)
        const day = date.toISOString().slice(0, 10)
        const status: ServiceStatus = {
            overall: 'degraded', generated_at: '', checks: [check], history: [
                { service: check.service, check_name: check.check_name, date: day, status: 'down', incident_ids: ['instability'] },
            ], incidents: [incident('instability', 'Instability')],
        }

        expect(historyDaysFor(status, check).at(-3)?.displayStatus).toBe('degraded')
    })
})
