import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const calls: Array<{ host: string; path: string; options?: RequestInit }> = []

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }),
}))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: any) => ({ valid: req.headers.id === 'admin' }),
}))
mock.module('#db', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    default: async (sql: string, params: unknown[] = []) => ({
        rows: sql.includes('SELECT name, owner, created_by, access_users, primary_host, deleted_at')
            ? [{ name: 'remote-vm', owner: 'owner', created_by: 'owner', access_users: [], primary_host: 'ovhcloud', deleted_at: null }]
            : sql.includes('vm_user_can_manage')
                ? [{ allowed: params[1] === 'owner' }]
                : [],
    }),
}))
mock.module('#constants', () => ({ default: { vm_host_id: 'ovhcloud' } }))
mock.module('#utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string, options?: RequestInit) => {
        calls.push({ host, path, options })
        return Response.json({ ok: true, name: 'remote-vm', status: 'running' })
    },
}))
mock.module('#utils/vms/status.ts', () => ({ invalidateLiveVmStatus: () => {} }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))

const { default: vmAction } = await import('../src/handlers/vms/action.ts')
const app = Fastify()
app.post('/vm/:id/:action', vmAction)

beforeEach(() => { calls.length = 0 })
afterAll(async () => { await app.close() })

test('start, stop and restart target the VM host even when local LXD is available', async () => {
    for (const action of ['start', 'stop', 'restart']) {
        const response = await app.inject({
            method: 'POST',
            url: `/vm/remote-vm/${action}`,
            headers: { id: 'admin' },
        })

        expect(response.statusCode).toBe(200)
        expect(calls.at(-1)?.host).toBe('ovhcloud')
        expect(calls.at(-1)?.path).toBe(`/vm/remote-vm/${action}`)
        expect(calls.at(-1)?.options?.headers).toEqual({ 'User-Agent': 'hanasand_internal' })
    }
})

test('an authenticated VM owner can manage the VM, but another viewer cannot', async () => {
    const ownerResponse = await app.inject({ method: 'POST', url: '/vm/remote-vm/start', headers: { id: 'owner' } })
    expect(ownerResponse.statusCode).toBe(200)
    expect(calls.at(-1)?.path).toBe('/vm/remote-vm/start')

    const strangerResponse = await app.inject({ method: 'POST', url: '/vm/remote-vm/start', headers: { id: 'stranger' } })
    expect(strangerResponse.statusCode).toBe(403)
    expect(calls).toHaveLength(1)
})
