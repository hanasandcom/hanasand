import { expect, mock, test } from 'bun:test'

const checkedAt = new Date().toISOString()
const incidentId = 'threat-intelligence-public-search-incident'
const currentCheck = {
    service: 'threat-intelligence',
    check_name: 'Public search',
    status: 'up',
    latency_ms: 42,
    message: 'Search is ready.',
    checked_at: checkedAt,
    uptime_30d: '100',
}
const currentWorkspaceCheck = {
    service: 'workspace',
    check_name: 'Runtime',
    status: 'up',
    latency_ms: 5,
    message: 'No workspace runtime errors in the recent log window.',
    checked_at: checkedAt,
    uptime_30d: '100',
}
const savedIncident = { id: incidentId, aliases: ['legacy-search-incident'], title: 'Public search interruption', updates: [] }
let incidentLookup: { sql: string, values: unknown[] | undefined } | undefined
let statusReads = 0
let snapshotEnsures = 0

mock.module('#db', () => ({
    default: async (sql: string, values?: unknown[]) => {
        statusReads++
        if (sql.includes('payload->>\'service\' AS service')) return { rows: [currentCheck, currentWorkspaceCheck] }
        if (sql.includes('payload, updated_at FROM service_status_snapshots')) throw new Error('Saved history read unavailable')
        if (sql.includes('payload->>\'generated_at\' AS generated_at')) {
            incidentLookup = { sql, values }
            const matchesAlias = sql.includes('incident->\'aliases\' ? $1') && values?.[0] === savedIncident.aliases[0]
            return { rows: matchesAlias ? [{ generated_at: checkedAt, incidents: [savedIncident] }] : [] }
        }
        throw new Error(`Unexpected status query: ${sql.slice(0, 100)}`)
    },
    withTransaction: async () => { throw new Error('Incident fallback must not rebuild history in this test.') },
}))
mock.module('../src/utils/status/snapshotSchema.ts', () => ({ ensureStatusSnapshots: async () => { snapshotEnsures++ } }))

const { default: getStatus } = await import('../src/handlers/status/get.ts')

function reply() {
    return {
        statusCode: 200,
        payload: undefined as unknown,
        header() { return this },
        type() { return this },
        status(code: number) { this.statusCode = code; return this },
        send(value: unknown) { this.payload = typeof value === 'string' ? JSON.parse(value) : value; return this },
    }
}

test('public search and saved incident routes preserve their response contracts', async () => {
    const originalError = console.error
    console.error = () => {}
    try {
        const readsBeforeUnknownCheck = statusReads
        const ensuresBeforeUnknownCheck = snapshotEnsures
        const unknownCheck = reply()
        await getStatus({ query: { check: 'unrecognized', incident: incidentId } } as never, unknownCheck as never)
        expect(unknownCheck.statusCode).toBe(404)
        expect(unknownCheck.payload).toEqual({ error: 'Unknown status check.' })
        expect(statusReads).toBe(readsBeforeUnknownCheck)
        expect(snapshotEnsures).toBe(ensuresBeforeUnknownCheck)

        const search = reply()
        await getStatus({ query: { check: 'public-search' } } as never, search as never)
        expect(search.statusCode).toBe(200)
        expect(search.payload).toMatchObject({ ok: true, status: 'up', latencyMs: 42, message: 'Search is ready.' })

        const summary = reply()
        await getStatus({ query: { summary: 'true' } } as never, summary as never)
        const summaryChecks = (summary.payload as { checks: { service: string, message: string | null }[] }).checks
        expect(summaryChecks.find(row => row.service === 'workspace')?.message).toBe('Normal workspace runtime traffic baseline.')

        const cachedSearch = reply()
        await getStatus({ query: { check: 'public-search' } } as never, cachedSearch as never)
        expect(cachedSearch.statusCode).toBe(200)
        expect((cachedSearch.payload as { message: string }).message).toBe('Search is ready.')

        const incident = reply()
        await getStatus({ query: { incident: 'legacy-search-incident' } } as never, incident as never)
        expect(incident.statusCode).toBe(200)
        expect(incident.payload).toMatchObject({ history_available: true, incidents: [savedIncident] })
        expect(incidentLookup?.sql).toContain('incident->\'aliases\' ? $1')
        expect(incidentLookup?.values).toEqual(['legacy-search-incident'])

        currentCheck.status = 'down'
        currentCheck.message = 'Search failed.'
        const readsBeforeFailedSearch = statusReads
        const failedSearch = reply()
        await getStatus({ query: { check: 'public-search' } } as never, failedSearch as never)
        expect(statusReads).toBe(readsBeforeFailedSearch)
        expect(failedSearch.statusCode).toBe(503)
        expect(failedSearch.payload).toMatchObject({ ok: false, service: 'public-search', status: 'down', checkedAt, latencyMs: 42, message: 'Search failed.', lastResult: 'down' })

        currentCheck.service = 'other'
        const readsBeforeMissingSearch = statusReads
        const missingSearch = reply()
        await getStatus({ query: { check: 'public-search' } } as never, missingSearch as never)
        expect(statusReads).toBe(readsBeforeMissingSearch)
        expect(missingSearch.statusCode).toBe(503)
        expect(missingSearch.payload).toMatchObject({ ok: false, service: 'public-search', status: 'unknown', checkedAt: null, latencyMs: null, message: 'No recent search check is available.', lastResult: null })
    } finally {
        console.error = originalError
    }
})
