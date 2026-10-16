import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let viewer: { id: string; admin: boolean } | null = { id: 'owner', admin: false }
let vm: { owner: string; organization_id?: string; deleted_at?: string } | null = { owner: 'owner' }
let org: { id: string; name: string } | null = { id: 'cashflow-org', name: 'Cashflow' }
let writes: string[] = []
let transactionCount = 0
const transactionQueries: Array<{ sql: string; params: unknown[] }> = []
mock.module('../src/utils/vms/access.ts', () => ({ vmViewer: async (_req: unknown, res: { status: (n: number) => { send: (v: unknown) => void } }) => {
    if (!viewer) res.status(401).send({ error: 'Unauthorized' })
    return viewer
} }))
mock.module('../src/utils/db.ts', () => ({ withTransaction: async (work: (q: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<unknown>) => {
    transactionCount++
    return work(async (sql, params = []) => {
        transactionQueries.push({ sql, params })
        if (sql.startsWith('SELECT * FROM vms')) return { rows: vm ? [vm] : [] }
        if (sql.includes('SELECT o.id')) return { rows: org ? [org] : [] }
        writes.push(sql); return { rows: [] }
    })
} }))
const { default: assign } = await import('../src/handlers/vms/organization.ts')
const app = Fastify()
app.put('/vm/:id/organization', assign)
const request = (payload: unknown = { organizationId: 'cashflow-org' }) => app.inject({ method: 'PUT', url: '/vm/personal/organization', payload })
beforeEach(() => {
    viewer = { id: 'owner', admin: false }
    vm = { owner: 'owner' }
    org = { id: 'cashflow-org', name: 'Cashflow' }
    writes = []
    transactionCount = 0
    transactionQueries.length = 0
})

test('personal owner can transfer to an organization with an audit event and no individual grants', async () => {
    expect((await request()).statusCode).toBe(200)
    expect(writes[0]).toContain('access_users = \'[]\'::jsonb')
    expect(writes[1]).toContain('vm.organization_assigned')
    expect(transactionCount).toBe(1)
    expect(transactionQueries[0]).toMatchObject({
        sql: expect.stringContaining('SELECT * FROM vms WHERE name = $1 FOR UPDATE'),
        params: ['personal'],
    })
    expect(transactionQueries[1]?.sql).toContain('m.role IN (\'owner\', \'admin\')')
    expect(transactionQueries[1]?.sql).toContain('FOR SHARE OF o, m')
    expect(transactionQueries[1]?.params).toEqual(['cashflow-org', 'owner'])
    expect(transactionQueries[2]?.params).toEqual(['personal', 'cashflow-org'])
    expect(transactionQueries[3]).toMatchObject({
        sql: expect.stringContaining('VALUES (\'vm.organization_assigned\''),
        params: ['owner', 'personal', 'cashflow-org'],
    })
})
test('transfer rejects another owner, unavailable membership and an already organizational VM', async () => {
    writes = []; vm = { owner: 'someone-else' }
    expect((await request()).statusCode).toBe(404)
    vm = { owner: 'owner' }; org = null
    expect((await request()).statusCode).toBe(403)
    org = { id: 'cashflow-org', name: 'Cashflow' }; vm.organization_id = 'existing'
    expect((await request()).statusCode).toBe(409)
    vm = { owner: 'owner', deleted_at: '2026-09-14' }
    expect((await request()).statusCode).toBe(409)
    expect(writes).toEqual([])
    viewer = null
    expect((await request()).statusCode).toBe(401)
})

test('transfer rejects a missing or blank organization id before opening a transaction', async () => {
    transactionCount = 0
    for (const organizationId of [undefined, null, '', '   ', 42]) {
        const response = await request({ organizationId })
        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ error: 'Choose an organization.' })
    }
    expect(transactionCount).toBe(0)
})
