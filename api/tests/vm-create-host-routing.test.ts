import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { resolveVmHostId } from '../src/utils/vms/hostConfig.ts'

const calls: Array<{ host: string; path: string; method?: string }> = []
let existingVm: Record<string, unknown> | undefined
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async (req: any) => ({ valid: req.headers.id === 'admin' }) }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => false }))
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    default: async (sql: string, params: unknown[] = []) => ({
        rows: /SELECT name, owner, created_by, access_users, primary_host, deleted_at/.test(sql)
            ? (existingVm ? [existingVm] : [])
            : /UPDATE vms\s+SET name/.test(sql)
                ? [{ ...existingVm, name: params[0], owner: params[1], created_by: params[2], access_users: [], primary_host: params[5] }]
                : /INSERT INTO vms/.test(sql)
                    ? [{ name: params[0], owner: params[1], created_by: params[2], access_users: [] }]
                    : [],
    }),
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string, options?: RequestInit) => {
        calls.push({ host, path, method: options?.method })
        return Response.json({ name: 'remote-vm', provisioned: true })
    },
}))
mock.module('../src/utils/vms/lxd.ts', () => ({
    canUseLocalLxd: async () => { throw new Error('Remote creation must not use this API host LXD socket.') },
    provisionLocalLxdInstance: async () => { throw new Error('Remote creation must not use this API host LXD socket.') },
}))
mock.module('../src/utils/vms/syncUserCertificatesToVm.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/logs/recordLog.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))

const { default: postVM } = await import('../src/handlers/vms/post.ts')
const app = Fastify()
app.post('/vm', postVM)
beforeEach(() => { calls.length = 0; existingVm = undefined })
afterAll(async () => { await app.close() })

test('VM host defaults to Inspur and preserves an explicit host setting', () => {
    expect(resolveVmHostId(undefined)).toBe('inspur')
    expect(resolveVmHostId('ovhcloud')).toBe('ovhcloud')
})

test('VM creation provisions through the configured primary host, not the central API socket', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    expect(calls).toEqual([{ host: 'inspur', path: '/vms/internal/remote-vm/provision', method: 'POST' }])
})

test('metadata-only VM creation skips host provisioning when explicitly requested', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', provision_local: false } })

    expect(response.statusCode).toBe(201)
    expect(calls).toEqual([])
})

test('admin metadata updates preserve the VM primary host and route provisioning there', async () => {
    existingVm = { name: 'prior-vm', owner: 'old-owner', created_by: 'old-owner', access_users: [], primary_host: 'inspur', deleted_at: null }
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'admin' },
        payload: { name: 'prior-vm', owner: 'new-owner', created_by: 'admin' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().primary_host).toBe('inspur')
    expect(calls).toEqual([{ host: 'inspur', path: '/vms/internal/prior-vm/provision', method: 'POST' }])
})
