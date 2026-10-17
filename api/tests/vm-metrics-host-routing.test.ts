import { afterEach, describe, expect, mock, test } from 'bun:test'

const queries: { sql: string, values?: unknown[] }[] = []
mock.module('#constants', () => ({ default: { vm_host_id: 'ovhcloud', lxd_socket_path: '/tmp/lxd.sock' } }))
mock.module('#db', () => ({
    default: async(sql: string, values?: unknown[]) => {
        queries.push({ sql, values })
        if (sql.includes('SELECT name FROM vms')) {
            const local = [{ name: 'ovh-vm' }]
            return { rows: sql.includes('primary_host') ? local : [...local, { name: 'inspur-vm' }] }
        }
        return { rows: [] }
    },
}))

const { default: collectVmMetrics } = await import('../src/utils/vms/collectMetrics.ts')
const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    queries.length = 0
})

describe('VM metrics host routing', () => {
    test('samples VMs assigned to this host without treating other hosts as missing', async() => {
        globalThis.fetch = mock(async(input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/1.0/metrics')) return new Response('')
            return Response.json({ metadata: [
                { name: 'ovh-vm', status: 'Stopped' },
                { name: 'inspur-vm', status: 'Stopped' },
            ] })
        }) as typeof fetch

        await expect(collectVmMetrics()).resolves.toEqual({ sampled: 1 })
        const select = queries.find(query => query.sql.includes('SELECT name FROM vms'))
        expect(select?.sql).toContain('LOWER(primary_host) = LOWER($1)')
        expect(select?.values).toEqual(['ovhcloud'])
        const insert = queries.find(query => query.sql.includes('INSERT INTO vm_metrics'))
        expect(JSON.parse(String(insert?.values?.[0])).map((sample: { name: string }) => sample.name)).toEqual(['ovh-vm'])
    })
})
