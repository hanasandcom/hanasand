import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const writes: Array<{ sql: string, params: unknown[] }> = []
mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => {
    writes.push({ sql, params })
    return { rows: [{ id: 'metric-1', name: 'cashflow', cpu_cores: 2 }] }
} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: true }) }))

const { default: postMetrics } = await import('../src/handlers/vms/metrics/post.ts')
const { default: putMetrics } = await import('../src/handlers/vms/metrics/put.ts')
const app = Fastify()
app.post('/vm/metrics', postMetrics)
app.put('/vm/metrics/:id', putMetrics)

beforeEach(() => { writes.length = 0 })

test('VM metrics POST and PUT issue validated writes and return the saved row', async () => {
    const poweredOnAt = '2026-10-15T12:00:00.000Z'
    const created = await app.inject({ method: 'POST', url: '/vm/metrics', payload: { name: 'cashflow', cpu_cores: 2, powered_on_at: poweredOnAt } })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toEqual({ id: 'metric-1', name: 'cashflow', cpu_cores: 2 })
    expect(writes[0]).toMatchObject({
        sql: expect.stringContaining('INSERT INTO vm_metrics (name,cpu_cores,powered_on_at)'),
        params: ['cashflow', 2, poweredOnAt],
    })

    writes.length = 0
    const updated = await app.inject({ method: 'PUT', url: '/vm/metrics/metric-1', payload: { cpu_cores: 4 } })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toEqual({ id: 'metric-1', name: 'cashflow', cpu_cores: 2 })
    expect(writes).toHaveLength(1)
    expect(writes[0]?.sql.startsWith('\n            UPDATE vm_metrics')).toBe(true)
    expect(writes[0]?.sql.includes('cpu_cores = $1')).toBe(true)
    expect(writes[0]?.params).toEqual([4, 'metric-1'])
})

test('VM metrics POST and PUT reject SQL column names and non-scalar values before writing', async () => {
    const invalidRequests = [
        { method: 'POST', url: '/vm/metrics', payload: { name: 'cashflow', 'cpu_cores) VALUES (0); DELETE FROM vms; --': 2 } },
        { method: 'PUT', url: '/vm/metrics/metric-1', payload: { 'cpu_cores = 0; DELETE FROM vms; --': 2 } },
        { method: 'POST', url: '/vm/metrics', payload: { name: 'cashflow', cpu_cores: { value: 2 } } },
        { method: 'PUT', url: '/vm/metrics/metric-1', payload: { cpu_cores: [2] } },
        { method: 'POST', url: '/vm/metrics', payload: { name: 'cashflow', cpu_cores: 'abc' } },
        { method: 'POST', url: '/vm/metrics', payload: { name: 'cashflow', power_state: 'invalid' } },
        { method: 'PUT', url: '/vm/metrics/metric-1', payload: { name: null } },
    ] as const

    for (const request of invalidRequests) {
        const response = await app.inject(request)
        expect(response.statusCode).toBe(400)
        expect(writes).toHaveLength(0)
    }
})
