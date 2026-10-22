import { expect, test } from 'bun:test'
import { toPublicServiceStatus, retainVerifiedStatus, isVerifiedStatus, compactStatusSnapshot } from '@/utils/status/publicStatus'
import getStatus, { unavailableServiceStatus } from '@/utils/status/getStatus'
import { serviceCheck } from './status-public-fixtures'
import { createStatusRefresher, restoreVerifiedSnapshot } from '@/app/status/statusDashboard/useStatusDashboardState'

test('unavailable status stays unverified instead of becoming synthetic healthy status', async () => {
    expect(unavailableServiceStatus()).toEqual({
        overall: 'unknown',
        monitoring: 'unavailable',
        generated_at: '',
        checks: [],
        history: [],
        incidents: [],
    })
    expect(toPublicServiceStatus(unavailableServiceStatus())).toMatchObject({ overall: 'unknown', monitoring: 'unavailable' })

})

test('status fetch failures preserve the unavailable contract for transport and non-2xx responses', async () => {
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = (async () => { throw new Error('status backend unavailable') }) as typeof fetch
        await expect(getStatus()).resolves.toEqual(unavailableServiceStatus())

        globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch
        await expect(getStatus()).resolves.toEqual(unavailableServiceStatus())
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('missing monitoring retains the last verified snapshot and never invents a refresh time', () => {
    const at = new Date().toISOString()
    const raw = { overall: 'up' as const, generated_at: at, checks: [
        serviceCheck('core', 'API health', at), serviceCheck('website', 'Public website', at),
        serviceCheck('threat-intelligence', 'Public search', at), serviceCheck('threat-intelligence', 'Processing backlog', at),
        serviceCheck('threat-intelligence', 'Source collection', at), serviceCheck('dark-web-monitoring', 'Monitoring workspace', at), serviceCheck('dark-web-monitoring', 'Latest activity', at),
    ], history: [], incidents: [] }
    const verified = toPublicServiceStatus(raw)
    expect(isVerifiedStatus(verified)).toBe(true)
    const failed = retainVerifiedStatus(toPublicServiceStatus(unavailableServiceStatus()), verified)
    expect(failed).toMatchObject({ overall: 'up', monitoring: 'unavailable', last_verified_at: at })
    expect(failed.checks).toHaveLength(8)
    expect(failed.checks.every(check => check.status === 'up' && check.checked_at === at)).toBe(true)
    expect(isVerifiedStatus(failed)).toBe(false)
    const stale = toPublicServiceStatus(raw, Date.now() + 6 * 60_000)
    expect(stale).toMatchObject({ overall: 'up', monitoring: 'unavailable', last_verified_at: at })
    raw.checks[0].status = 'down'
    expect(toPublicServiceStatus(raw).overall).toBe('down')
})


test('compaction keeps linked evidence while bounding persisted status size', () => {
    const incident = { id: 'first', service: 'Core platform', check_name: 'API Health', title: 'API interruption', impact: 'Outage' as const, status: 'resolved' as const, started_at: '2026-09-19T00:00:00Z', resolved_at: '2026-09-19T00:01:00Z', summary: 'Failed check.', cause: 'Unknown', updates: [{ at: '2026-09-19T00:00:00Z', status: 'investigating', message: 'Evidence'.repeat(1000) }] }
    const source = { ...unavailableServiceStatus(), history: [{ service: 'Core platform', check_name: 'API Health', date: '2026-09-19', status: 'down' as const, incident_ids: ['9999'] }], incidents: Array.from({ length: 15000 }, (_, id) => ({ ...incident, id: String(id) })) }
    const stored = compactStatusSnapshot(source)
    expect(JSON.stringify(stored).length).toBeLessThan(50000)
    expect(stored.incidents.some(row => row.id === '9999')).toBe(true)
    expect(source.incidents[0].updates).toHaveLength(1)
})

test('compaction keeps the first 25 incidents and history-linked evidence beyond that limit', () => {
    const incident = { id: '', service: 'Core platform', check_name: 'API Health', title: 'API interruption', impact: 'Outage' as const, status: 'resolved' as const, started_at: '2026-09-19T00:00:00Z', resolved_at: '2026-09-19T00:01:00Z', summary: 'Failed check.', cause: 'Unknown', updates: [{ at: '2026-09-19T00:00:00Z', status: 'investigating', message: 'Evidence' }] }
    const source = {
        ...unavailableServiceStatus(),
        history: [{ service: 'Core platform', check_name: 'API Health', date: '2026-09-19', status: 'down' as const, incident_ids: ['incident-26', 'incident-25'] }],
        incidents: Array.from({ length: 27 }, (_, id) => ({ ...incident, id: `incident-${id}` })),
    }

    const stored = compactStatusSnapshot(source)

    expect(stored.incidents.map(row => row.id)).toEqual([
        ...Array.from({ length: 25 }, (_, id) => `incident-${id}`),
        'incident-26',
    ])
    expect(stored.history[0].incident_ids).toEqual(['incident-26'])
    expect(stored.incidents.every(row => row.updates.length === 0)).toBe(true)
    expect(source.incidents[0].updates).toHaveLength(1)
    expect(source.history[0].incident_ids).toEqual(['incident-26', 'incident-25'])
})

test('status dashboard restores a newer saved snapshot and persists a compact successful refresh', async () => {
    const at = new Date().toISOString()
    const raw = verifiedStatus(at)
    const serverStatus = toPublicServiceStatus({ ...raw, generated_at: new Date(Date.now() - 60_000).toISOString(), checks: raw.checks.map(check => ({ ...check, checked_at: new Date(Date.now() - 60_000).toISOString() })) })
    const savedStatus = toPublicServiceStatus(raw)
    const restored: { current?: ReturnType<typeof unavailableServiceStatus> } = {}
    const verified = { current: serverStatus }
    const saved = JSON.stringify(savedStatus)
    restoreVerifiedSnapshot(update => { restored.current = update(unavailableServiceStatus()) }, verified, { getItem: () => saved })
    expect(verified.current).toEqual(savedStatus)
    expect(restored.current).toMatchObject({ monitoring: 'unavailable', last_verified_at: at })

    const incidents = Array.from({ length: 30 }, (_, id) => ({ ...raw.incidents[0], id: `incident-${id}`, updates: [{ at, status: 'investigating', message: 'Timeline' }] }))
    const responseStatus = { ...raw, incidents }
    const storage = new Map<string, string>()
    const originalFetch = globalThis.fetch
    let current = unavailableServiceStatus()
    let refreshError = false
    try {
        globalThis.fetch = (async () => new Response(JSON.stringify(responseStatus), { status: 200 })) as typeof fetch
        await createStatusRefresher('status', value => { current = value }, value => { refreshError = value }, { current: undefined }, {
            setItem: (key, value) => { storage.set(key, value) },
        })()
    } finally { globalThis.fetch = originalFetch }

    const persisted = JSON.parse(storage.get('hanasand-verified-status') || 'null')
    expect(current.monitoring).toBe('live')
    expect(refreshError).toBe(false)
    expect(persisted.incidents).toHaveLength(25)
    expect(persisted.incidents.every((incident: { updates: unknown[] }) => incident.updates.length === 0)).toBe(true)
})

test('failed status refresh leaves the verified snapshot unchanged and marks monitoring unavailable', async () => {
    const verified = toPublicServiceStatus(verifiedStatus(new Date().toISOString()))
    const storage = new Map<string, string>()
    const originalFetch = globalThis.fetch
    let current = verified
    let refreshError = false
    try {
        globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch
        await createStatusRefresher('status', value => { current = value }, value => { refreshError = value }, { current: verified }, {
            setItem: (key, value) => { storage.set(key, value) },
        })()
    } finally { globalThis.fetch = originalFetch }

    expect(refreshError).toBe(true)
    expect(current).toEqual(verified)
    expect(storage.size).toBe(0)
})

test('restricted local storage cannot interrupt restore or a stale status refresh', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const originalFetch = globalThis.fetch
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage is blocked') } })
    let current = unavailableServiceStatus()
    let refreshError = false
    try {
        expect(() => restoreVerifiedSnapshot(() => undefined, { current: undefined })).not.toThrow()
        const stale = verifiedStatus(new Date(Date.now() - 6 * 60_000).toISOString())
        globalThis.fetch = (async () => new Response(JSON.stringify(stale), { status: 200 })) as typeof fetch
        await createStatusRefresher('status', value => { current = value }, value => { refreshError = value }, { current: undefined })()
    } finally {
        globalThis.fetch = originalFetch
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
        else Reflect.deleteProperty(globalThis, 'localStorage')
    }

    expect(refreshError).toBe(true)
    expect(current).toMatchObject({ overall: 'up', monitoring: 'unavailable' })
})

function verifiedStatus(at: string) {
    return {
        overall: 'up' as const,
        generated_at: at,
        history: [],
        incidents: [{ id: 'seed', service: 'core', check_name: 'API health', title: 'API interruption', impact: 'Outage' as const, status: 'resolved' as const, started_at: at, resolved_at: at, summary: 'Recovered.', cause: 'Unknown', updates: [] }],
        checks: [
            serviceCheck('core', 'API health', at), serviceCheck('website', 'Public website', at),
            serviceCheck('threat-intelligence', 'Public search', at), serviceCheck('threat-intelligence', 'Processing backlog', at),
            serviceCheck('threat-intelligence', 'Source collection', at), serviceCheck('dark-web-monitoring', 'Monitoring workspace', at), serviceCheck('dark-web-monitoring', 'Latest activity', at),
        ],
    }
}
