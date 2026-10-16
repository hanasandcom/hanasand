import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { toPublicServiceStatus, retainVerifiedStatus, isVerifiedStatus, compactStatusSnapshot } from '@/utils/status/publicStatus'
import getStatus, { unavailableServiceStatus } from '@/utils/status/getStatus'
import { serviceCheck } from './status-public-fixtures'

const root = process.cwd()

test('status transport failure stays unavailable instead of becoming fresh synthetic status', async () => {
    expect(unavailableServiceStatus()).toEqual({
        overall: 'unknown',
        monitoring: 'unavailable',
        generated_at: '',
        checks: [],
        history: [],
        incidents: [],
    })
    expect(toPublicServiceStatus(unavailableServiceStatus())).toMatchObject({ overall: 'unknown', monitoring: 'unavailable' })

    for (const route of ['src/app/api/status/route.ts', 'src/app/status/page.tsx', 'src/app/status/incidents/page.tsx', 'src/app/status/incidents/[id]/page.tsx']) {
        const source = await readFile(path.join(root, route), 'utf8')
        expect(source).not.toContain('withFallback')
        expect(source).not.toContain('getFallbackServiceStatus')
        expect(source).not.toContain('publicStatusCoverageCheck')
        expect(source).not.toContain('productProgressDeployProof')
        expect(source).not.toContain('loadProductDeployProofLedger')
    }
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
        serviceCheck('threat-intelligence', 'Source collection', at), serviceCheck('browser-sandbox', 'Browser workspace', at),
        serviceCheck('dark-web-monitoring', 'Monitoring workspace', at), serviceCheck('dark-web-monitoring', 'Latest activity', at),
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


test('browser persistence bounds old incident feeds and preserves linked evidence', () => {
    const incident = { id: 'first', service: 'Core platform', check_name: 'API Health', title: 'API interruption', impact: 'Outage' as const, status: 'resolved' as const, started_at: '2026-09-19T00:00:00Z', resolved_at: '2026-09-19T00:01:00Z', summary: 'Failed check.', cause: 'Unknown', updates: [{ at: '2026-09-19T00:00:00Z', status: 'investigating', message: 'Evidence'.repeat(1000) }] }
    const source = { ...unavailableServiceStatus(), history: [{ service: 'Core platform', check_name: 'API Health', date: '2026-09-19', status: 'down' as const, incident_ids: ['9999'] }], incidents: Array.from({ length: 15000 }, (_, id) => ({ ...incident, id: String(id) })) }
    const stored = compactStatusSnapshot(source)
    expect(JSON.stringify(stored).length).toBeLessThan(50000)
    expect(stored.incidents.some(row => row.id === '9999')).toBe(true)
    expect(source.incidents[0].updates).toHaveLength(1)
})
