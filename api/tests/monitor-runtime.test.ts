import { afterAll, expect, mock, test } from 'bun:test'

type Scenario = {
    serviceToken: string
    storageState: 'available' | 'offline' | 'missing'
    sourceCount: number
    failedSourceCount: number
    degradedSourceCount: number
    pendingWrites: number
    lastSuccessAgeMs: number
    searchResponses: number[]
    retryTimerAdvanceMs?: number
}

type RequestRecord = { url: string, serviceToken: string | null, timeoutMs: number | undefined }

const now = Date.now()
const savedEnvironment = new Map<string, string | undefined>()
const monitorEnvironment: Record<string, string> = {
    MONITOR_API_BASE: 'http://api.test/api',
    MONITOR_PUBLIC_API_BASE: 'http://api.test/api/v1',
    MONITOR_WEB_BASE: 'http://web.test',
    TI_SCRAPER_API_BASE: 'http://scraper.test',
    HANASAND_MODEL_CLIENT_HEALTH_BASE: 'http://model.test',
    MONITOR_SERVICE_ACCOUNT_KEY: 'hsk_fixture',
    TI_SCRAPER_SERVICE_TOKEN: 'ti_fixture',
}
for (const [key, value] of Object.entries(monitorEnvironment)) {
    savedEnvironment.set(key, process.env[key])
    process.env[key] = value
}

const sqlCalls: string[] = []
let currentChecks: Record<string, unknown>[] = []
let historySnapshot: Record<string, unknown> | null = null
let statusHistoryQueries = 0
const recordedChecks: Array<{ service: string, name: string, status: string, message: string }> = []
let scenario: Scenario = {
    serviceToken: 'ti_fixture',
    storageState: 'available',
    sourceCount: 60,
    failedSourceCount: 0,
    degradedSourceCount: 0,
    pendingWrites: 0,
    lastSuccessAgeMs: 60_000,
    searchResponses: [200],
    retryTimerAdvanceMs: undefined,
}
let requests: RequestRecord[] = []
let searchRequestCount = 0

mock.module('#db', () => ({
    default: async (sql: string) => {
        const statement = sql.trimStart()
        sqlCalls.push(statement)
        if (!statement.startsWith('SELECT')) throw new Error('The monitor route test only permits recorded SELECT queries.')
        if (statement.includes('payload->>\'service\' AS service')) return { rows: currentChecks }
        if (statement.includes('payload, updated_at FROM service_status_snapshots WHERE id = \'history-v2\'')) {
            return { rows: historySnapshot ? [{ payload: historySnapshot, updated_at: new Date(now).toISOString() }] : [] }
        }
        if (statement.includes('configured_organizations')) return { rows: [{ configured_organizations: 1 }] }
        if (statement.includes('recent_delivery_failures')) return { rows: [{ recent_delivery_failures: 0 }] }
        if (statement.includes('FROM service_monitor_results')) return { rows: [{ status: 'up', message: '1,000 retained records' }] }
        throw new Error(`Unexpected monitor query: ${statement.slice(0, 100)}`)
    },
    // The recorder feeds fixed rows to getStatus; it never executes SQL or models PostgreSQL semantics.
    withTransaction: async (operation: (query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>) => Promise<unknown>) => operation(async (sql, values = []) => {
        const statement = sql.trimStart()
        sqlCalls.push(statement)
        if (statement.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] }
        if (statement.startsWith('SET LOCAL')) return { rows: [] }
        if (statement.startsWith('WITH latest AS')) return { rows: currentChecks }
        if (statement.startsWith('WITH sequenced AS')) {
            statusHistoryQueries++
            return { rows: [{
                service: 'threat-intelligence', check_name: 'Public search', status: 'down', message: 'Search unavailable.',
                checked_at: new Date(now - 60_000).toISOString(), previous_status: 'up', previous_checked_at: new Date(now - 90_000).toISOString(),
                next_status: 'up', next_checked_at: new Date(now - 30_000).toISOString(), next_message: 'Search recovered.',
            }] }
        }
        if (statement.includes('COUNT(*) FILTER (WHERE status = \'up\')')) return { rows: [{
            service: 'threat-intelligence', check_name: 'Public search', date: new Date(now).toISOString().slice(0, 10),
            samples: 3, healthy_samples: 2, degraded_samples: 0, failed_samples: 1, status: 'down',
        }] }
        if (statement.startsWith('INSERT INTO service_status_snapshots')) {
            historySnapshot = JSON.parse(String(values[0]))
            return { rows: [] }
        }
        throw new Error(`Unexpected status transaction query: ${statement.slice(0, 100)}`)
    }),
}))
mock.module('../src/utils/status/record.ts', () => ({
    recordMonitorResult: async (service: string, name: string, status: string, _latency: number, message: string) => {
        recordedChecks.push({ service, name, status, message })
    },
}))
mock.module('../src/utils/status/snapshotSchema.ts', () => ({ ensureStatusSnapshots: async () => {} }))

const { default: runSyntheticMonitor } = await import('../src/utils/status/monitor.ts')
const { default: getStatus } = await import('../src/handlers/status/get.ts')

afterAll(() => {
    for (const [key, value] of savedEnvironment) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
})

function json(body: unknown, status = 200) {
    return Response.json(body, { status })
}

function healthyCollection() {
    const lastSuccessAt = new Date(Date.now() - scenario.lastSuccessAgeMs).toISOString()
    const loop = { enabled: true, intervalSeconds: 300, lastSuccessAt, consecutiveErrorCount: 0, latestResult: { status: 'completed' } }
    return {
        ok: true,
        ...(scenario.storageState === 'missing' ? {} : { storage: { databaseAvailable: scenario.storageState === 'available', pendingWrites: scenario.pendingWrites } }),
        collection: { public: loop, publicDefault: loop, restrictedMetadata: loop },
    }
}

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

async function runMonitor(patch: Partial<Scenario> = {}) {
    scenario = { ...scenario, ...patch }
    recordedChecks.length = 0
    requests = []
    searchRequestCount = 0
    const originalFetch = globalThis.fetch
    const originalError = console.error
    const originalAbortTimeout = AbortSignal.timeout
    AbortSignal.timeout = ((milliseconds: number) => {
        const signal = new AbortController().signal as AbortSignal & { timeoutMs?: number }
        Object.defineProperty(signal, 'timeoutMs', { value: milliseconds })
        return signal
    }) as typeof AbortSignal.timeout
    console.error = () => {}
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = new URL(String(input))
        const headers = new Headers(init.headers)
        requests.push({ url: `${url.pathname}${url.search}`, serviceToken: headers.get('x-hanasand-service-token'), timeoutMs: (init.signal as AbortSignal & { timeoutMs?: number } | null)?.timeoutMs })

        if (url.pathname === '/api/service-accounts/self') return json({ id: 'monitor-fixture' })
        if (url.pathname === '/api/v1/openapi.json') return json({ openapi: '3.1.0', paths: {} })
        if (url.pathname === '/api/v1/ti/search') {
            const status = scenario.searchResponses[Math.min(searchRequestCount++, scenario.searchResponses.length - 1)]
            return json(status === 200 ? { mode: 'scraper', sources: [], recentActivity: [] } : { error: 'Unavailable' }, status)
        }
        if (url.origin === 'http://web.test') return new Response(url.pathname === '/' ? '<title>Hanasand</title>' : url.pathname === '/sandbox' ? 'Sandbox' : 'Dark web monitoring')
        if (url.pathname === '/health') return json({ connected: true, modelHealth: { ready: true }, model: 'fixture' })
        if (url.pathname === '/v1/health') return json(healthyCollection())
        if (url.pathname === '/v1/intel/source-operations' && url.search === '?summary=true') {
            if (headers.get('x-hanasand-service-token') !== scenario.serviceToken) return json({ error: 'Unauthorized' }, 401)
            return json({ summary: { sourceCount: scenario.sourceCount, failedSourceCount: scenario.failedSourceCount, degradedSourceCount: scenario.degradedSourceCount, measurementState: 'measured' } })
        }
        if (url.pathname === '/v1/internal/processing-backlog') {
            if (headers.get('x-hanasand-service-token') !== scenario.serviceToken) return json({ error: 'Unauthorized' }, 401)
            return json({ runtime_organizations: 1, stale_reviews: 0, oldest_review_age_minutes: 0, overdue_discovery: 0, stalled_evaluations: 0, unreviewed_sources: 0 })
        }
        if (url.pathname === '/v1/dwm/exposure-queue') {
            if (headers.get('x-hanasand-service-token') !== scenario.serviceToken) return json({ error: 'Unauthorized' }, 401)
            return json({ status: 'live', items: [{ id: 'fixture' }], counts: { total: 1 }, freshness: { collectionAgeMinutes: 1, maxLiveAgeMinutes: 60 } })
        }
        return json({})
    }) as typeof fetch
    try {
        await runSyntheticMonitor()
        return { recorded: [...recordedChecks], requests: [...requests], searchRequestCount }
    } finally {
        globalThis.fetch = originalFetch
        console.error = originalError
        AbortSignal.timeout = originalAbortTimeout
    }
}

test('monitor and status routes behave through controlled fetch and SQL recorders', async () => {
    currentChecks = [{ service: 'threat-intelligence', check_name: 'Public search', status: 'up', latency_ms: 42, message: 'Search is ready.', checked_at: new Date(now).toISOString(), uptime_30d: '100' }]
    historySnapshot = null
    const dashboardReply = reply()
    await getStatus({ query: { dashboard: 'true' } } as never, dashboardReply as never)
    for (let attempt = 0; attempt < 10 && !historySnapshot; attempt++) await Bun.sleep(0)
    expect(historySnapshot).not.toBeNull()
    const refreshedDashboard = reply()
    await getStatus({ query: { dashboard: 'true' } } as never, refreshedDashboard as never)
    const incidentId = (refreshedDashboard.payload as any).incidents[0].id
    const historyReply = reply()
    await getStatus({ query: { incident: incidentId } } as never, historyReply as never)
    expect(historyReply.statusCode).toBe(200)
    expect((historyReply.payload as any).incidents[0].updates[0].evidence).toBe('Search recovered.')
    expect(statusHistoryQueries).toBe(1)
    const publicSearchReply = reply()
    await getStatus({ query: { check: 'public-search' } } as never, publicSearchReply as never)
    expect(publicSearchReply.statusCode).toBe(200)
    expect(publicSearchReply.payload).toMatchObject({ ok: true, status: 'up', latencyMs: 42, message: 'Search is ready.' })
    expect(sqlCalls.filter(sql => !sql.startsWith('SELECT') && !sql.startsWith('WITH') && !sql.startsWith('SET LOCAL') && !sql.startsWith('INSERT INTO service_status_snapshots'))).toEqual([])

    const baseline = await runMonitor()
    expect(baseline.recorded.find(row => row.name === 'Service account authentication')?.status).toBe('up')
    expect(baseline.requests.find(row => row.url === '/api/service-accounts/self')?.timeoutMs).toBe(5_000)
    const publicSearchTimeout = baseline.requests.find(row => row.url === '/api/v1/ti/search')?.timeoutMs
    expect(publicSearchTimeout).toBeGreaterThan(4_900)
    expect(publicSearchTimeout).toBeLessThanOrEqual(5_000)
    expect(baseline.requests.find(row => row.url === '/v1/intel/source-operations?summary=true')).toMatchObject({ serviceToken: 'ti_fixture', timeoutMs: 5_000 })
    expect(baseline.requests.find(row => row.url === '/v1/dwm/exposure-queue?limit=1&tenantId=default')).toMatchObject({
        serviceToken: 'ti_fixture',
    })
    const latestActivityTimeout = baseline.requests.find(row => row.url === '/v1/dwm/exposure-queue?limit=1&tenantId=default')?.timeoutMs
    expect(latestActivityTimeout).toBeGreaterThan(4_900)
    expect(latestActivityTimeout).toBeLessThanOrEqual(5_000)
    expect(baseline.requests.filter(row => row.url === '/v1/internal/processing-backlog').every(row => row.serviceToken === 'ti_fixture')).toBe(true)
    expect(baseline.recorded.find(row => row.name === 'Processing backlog')?.status).toBe('up')
    expect(sqlCalls.some(sql => sql.includes('threat_intel.'))).toBe(false)

    expect((await runMonitor({ failedSourceCount: 2 })).recorded.find(row => row.name === 'Source operations')?.status).toBe('up')
    expect((await runMonitor({ failedSourceCount: 2, degradedSourceCount: 1 })).recorded.find(row => row.name === 'Source operations')?.status).toBe('degraded')
    expect((await runMonitor({ pendingWrites: 999 })).recorded.find(row => row.name === 'Source collection')?.status).toBe('up')
    expect((await runMonitor({ pendingWrites: 1_000 })).recorded.find(row => row.name === 'Source collection')?.status).toBe('degraded')
    expect((await runMonitor({ storageState: 'offline', pendingWrites: 0 })).recorded.find(row => row.name === 'Source collection')?.status).toBe('down')
    expect((await runMonitor({ storageState: 'missing' })).recorded.find(row => row.name === 'Source collection')?.status).toBe('down')
    scenario = { ...scenario, storageState: 'available' }
    const realNowForFreshness = Date.now
    Date.now = () => now
    try {
        expect((await runMonitor({ lastSuccessAgeMs: 900_000, pendingWrites: 0 })).recorded.find(row => row.name === 'Source collection')?.status).toBe('up')
        expect((await runMonitor({ lastSuccessAgeMs: 900_001 })).recorded.find(row => row.name === 'Source collection')?.status).toBe('down')
    } finally {
        Date.now = realNowForFreshness
    }
    const unauthorized = await runMonitor({ serviceToken: 'wrong_fixture' })
    expect(unauthorized.recorded.filter(row => ['Source operations', 'Latest activity', 'Processing backlog', 'Watchlist processing'].includes(row.name)).every(row => row.status === 'down')).toBe(true)

    const originalNow = Date.now
    const originalTimer = globalThis.setTimeout
    let fakeNow = now
    Date.now = () => fakeNow
    ;(globalThis as any).setTimeout = (callback: (...args: any[]) => void, milliseconds = 0, ...args: any[]) => {
        fakeNow += scenario.retryTimerAdvanceMs ?? milliseconds
        queueMicrotask(() => callback(...args))
        return 0
    }
    try {
        const retries = await runMonitor({ searchResponses: [503, 503, 503] })
        expect(retries.searchRequestCount).toBe(3)
        expect(retries.requests.filter(row => row.url === '/api/v1/ti/search').map(row => row.timeoutMs)).toEqual([5_000, 4_000, 3_000])
        expect(retries.recorded.find(row => row.name === 'Public search')?.status).toBe('down')
        const deadline = await runMonitor({ searchResponses: [503], retryTimerAdvanceMs: 5_000 })
        expect(deadline.searchRequestCount).toBe(1)
    } finally {
        Date.now = originalNow
        globalThis.setTimeout = originalTimer
    }
})
