import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { resolveVmHostId } from '../src/utils/vms/hostConfig.ts'

const calls: Array<{ host: string; path: string; method?: string; body?: BodyInit | null }> = []
let existingVm: Record<string, unknown> | undefined
let failedProvisionRequests = 0
let queuedProvisionResponses: Response[] = []
let queuedStatusResponses: Response[] = []
let deferProvisionResponse = false
let releaseProvisionResponse: (() => void) | undefined
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
                : /UPDATE vms SET primary_host/.test(sql)
                    ? [existingVm = { ...existingVm, name: params[0], primary_host: params[1] }]
                    : /INSERT INTO vms/.test(sql)
                        ? [existingVm = { name: params[0], owner: params[1], created_by: params[2], access_users: [], primary_host: 'ovhcloud', has_vm_details: false }]
                        : [],
    }),
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string, options?: RequestInit) => {
        calls.push({ host, path, method: options?.method, body: options?.body })
        if (failedProvisionRequests > 0) {
            failedProvisionRequests--
            return Response.json({ error: 'Temporary host failure.' }, { status: 502 })
        }
        if (path.endsWith('/status')) return queuedStatusResponses.shift() ?? Response.json({ status: 'Running' })
        if (path.endsWith('/provision')) {
            const response = queuedProvisionResponses.shift() ?? Response.json({ name: 'remote-vm', provisioned: true })
            if (deferProvisionResponse) await new Promise<void>(resolve => { releaseProvisionResponse = resolve })
            return response
        }
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
beforeEach(() => { calls.length = 0; existingVm = undefined; failedProvisionRequests = 0; queuedProvisionResponses = []; queuedStatusResponses = []; deferProvisionResponse = false; releaseProvisionResponse = undefined })
afterAll(async () => { await app.close() })
async function waitFor(check: () => boolean) {
    for (let attempt = 0; attempt < 100 && !check(); attempt++) await Bun.sleep(2)
    expect(check()).toBe(true)
}

test('VM host defaults to Inspur and preserves an explicit host setting', () => {
    expect(resolveVmHostId(undefined)).toBe('inspur')
    expect(resolveVmHostId('ovhcloud')).toBe('ovhcloud')
})

test('VM creation provisions through the configured primary host, not the central API socket', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    expect(response.json().primary_host).toBe('inspur')
    expect(calls).toEqual([{ host: 'inspur', path: '/vms/internal/remote-vm/provision', method: 'POST', body: JSON.stringify({ os: 'ubuntu-24.04', services: [] }) }])
})

test('VM creation forwards the selected OS and services to its assigned host', async () => {
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'remote-vm', os: 'ubuntu-22.04', services: ['nodejs', 'redis'] },
    })
    expect(response.statusCode).toBe(201)
    expect(calls[0]).toMatchObject({
        host: 'inspur', path: '/vms/internal/remote-vm/provision', method: 'POST',
        body: JSON.stringify({ os: 'ubuntu-22.04', services: ['nodejs', 'redis'] }),
    })
})

test('VM creation returns while the accepted host provision job is still running', async () => {
    queuedProvisionResponses = [Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })]
    queuedStatusResponses = [Response.json({ status: 'Running' })]
    deferProvisionResponse = true

    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    expect(calls.map(call => call.path)).toEqual(['/vms/internal/remote-vm/provision'])
    releaseProvisionResponse?.()
    await waitFor(() => calls.some(call => call.path.endsWith('/status')))
    expect(calls.map(call => call.path)).toEqual(['/vms/internal/remote-vm/provision', '/vms/internal/remote-vm/status'])
})

test('VM creation remains accepted when the host rejects its background provisioning request', async () => {
    queuedProvisionResponses = [Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })]
    queuedStatusResponses = [Response.json({ status: 'Error' })]

    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ name: 'remote-vm' })
})

test('metadata-only VM creation skips host provisioning when explicitly requested', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', provision_local: false } })

    expect(response.statusCode).toBe(201)
    expect(calls).toEqual([])
})

test('owner can retry provisioning after a failed first create without duplicating the VM row', async () => {
    failedProvisionRequests = 1
    const first = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })
    expect(first.statusCode).toBe(201)
    expect(existingVm).toMatchObject({ name: 'remote-vm', owner: 'member', primary_host: 'inspur', has_vm_details: false })

    const retry = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(retry.statusCode).toBe(201)
    expect(retry.json().primary_host).toBe('inspur')
    expect(calls).toHaveLength(2)
    expect(calls.every(call => call.path === '/vms/internal/remote-vm/provision')).toBe(true)
})

test('admin metadata updates preserve the VM primary host and route provisioning there', async () => {
    existingVm = { name: 'prior-vm', owner: 'old-owner', created_by: 'old-owner', access_users: [], primary_host: 'inspur', deleted_at: null }
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'admin' },
        payload: { name: 'prior-vm', owner: 'new-owner', created_by: 'admin' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().primary_host).toBe('inspur')
    expect(calls).toEqual([{ host: 'inspur', path: '/vms/internal/prior-vm/provision', method: 'POST', body: JSON.stringify({ os: 'ubuntu-24.04', services: [] }) }])
})
