import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const calls: Array<{ host: string; path: string; options?: RequestInit }> = []

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }),
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: any) => ({ valid: req.headers.id === 'admin' }),
}))
mock.module('../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    default: async (sql: string) => ({
        rows: sql.includes('SELECT name, owner, created_by, access_users, primary_host, deleted_at')
            ? [{ name: 'remote-vm', owner: 'owner', created_by: 'owner', access_users: [], primary_host: 'ovhcloud', deleted_at: null }]
            : [],
    }),
}))
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/vms/lxd.ts', () => ({
    canUseLocalLxd: async () => false,
    setLocalLxdInstanceState: async () => { throw new Error('Unexpected local action') },
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string, options?: RequestInit) => {
        calls.push({ host, path, options })
        return Response.json({ ok: true, name: 'remote-vm', status: 'running' })
    },
}))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))

const { default: vmAction } = await import('../src/handlers/vms/action.ts')
const app = Fastify()
app.post('/vm/:id/:action', vmAction)

beforeEach(() => { calls.length = 0 })
afterAll(async () => { await app.close() })

test('start, stop and restart target the VM primary host when local LXD is unavailable', async () => {
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
