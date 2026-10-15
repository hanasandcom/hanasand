import { expect, mock, test } from 'bun:test'

const observations: Array<{ status: string, checked_at: string, latency_ms: number, message: string }> = []
const incidents: Array<{ status: string, incidentStartedAt: string }> = []
let checkedAt = Date.parse('2026-10-16T12:00:00.000Z')

mock.module('#db', () => ({
    default: async () => ({ rows: [] }),
    withTransaction: async (operation: (query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>) => Promise<unknown>) => operation(async (sql, values = []) => {
        if (sql.includes('FROM service_monitor_results')) return { rows: observations.slice(0, 4) }
        if (sql.includes('INSERT INTO service_monitor_results')) {
            const row = { status: values[2] as string, checked_at: new Date(checkedAt += 1_000).toISOString(), latency_ms: values[3] as number, message: values[4] as string }
            observations.unshift(row)
            return { rows: [{ checked_at: row.checked_at }] }
        }
        return { rows: [] }
    }),
}))
mock.module('../src/utils/status/snapshotSchema.ts', () => ({ ensureStatusSnapshots: async () => {} }))
mock.module('../src/utils/status/serviceCheckCase.ts', () => ({ recordServiceCheckCase: async () => {} }))
mock.module('../src/utils/status/serviceIncident.ts', () => ({ notifyServiceMonitorIncident: async (incident: { status: string, incidentStartedAt: string }) => { incidents.push(incident) } }))

const { recordMonitorResult } = await import('../src/utils/status/record.ts')

test('a recovered outage is reported once while a sustained outage is reported', async () => {
    for (let index = 0; index < 3; index++) await recordMonitorResult('website', 'Public website', 'down', 10, 'Unavailable')
    await recordMonitorResult('website', 'Public website', 'degraded', 10, 'Recovering')
    await recordMonitorResult('website', 'Public website', 'up', 10, 'Ready')
    await recordMonitorResult('website', 'Public website', 'up', 10, 'Ready')

    expect(incidents.map(({ status }) => status)).toEqual(['down', 'up'])
    expect(incidents[1].incidentStartedAt).toBe(incidents[0].incidentStartedAt)
})
