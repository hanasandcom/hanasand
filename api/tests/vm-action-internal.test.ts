import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let authorized = false
let primaryHost = 'ovhcloud'
let active = true
const queries: unknown[][] = []
const actions: Array<{ name: string; action: string }> = []
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'ovhcloud' } }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => authorized }))
mock.module('../src/utils/db.ts', () => ({
    default: async (_sql: string, params: unknown[]) => {
        queries.push(params)
        return { rows: active ? [{ primary_host: primaryHost }] : [] }
    },
}))
mock.module('../src/utils/vms/lxd.ts', () => ({
    canUseLocalLxd: async () => true,
    setLocalLxdInstanceState: async (name: string, action: string) => {
        actions.push({ name, action })
        return { name, status: action === 'stop' ? 'Stopped' : 'Running' }
    },
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({ supportedHost: (host: string) => ['inspur', 'ovhcloud'].includes(host) }))

const { default: vmActionInternal } = await import('../src/handlers/vms/actionInternal.ts')
const app = Fastify()
app.post('/vms/internal/:name/:action', vmActionInternal)
beforeEach(() => { authorized = false; primaryHost = 'ovhcloud'; active = true; queries.length = 0; actions.length = 0 })
afterAll(async () => { await app.close() })

test('requires the internal token before reading the VM', async () => {
    const response = await app.inject({ method: 'POST', url: '/vms/internal/remote-vm/start' })
    expect(response.statusCode).toBe(401)
    expect(queries).toEqual([])
})

test('runs start, stop and restart on the assigned host LXD', async () => {
    authorized = true
    for (const action of ['start', 'stop', 'restart']) {
        const response = await app.inject({ method: 'POST', url: `/vms/internal/remote-vm/${action}` })
        expect(response.statusCode).toBe(200)
        expect(response.json().name).toBe('remote-vm')
    }
    expect(actions).toEqual(['start', 'stop', 'restart'].map(action => ({ name: 'remote-vm', action })))
})

test('rejects VMs assigned to another host and inactive VMs without touching LXD', async () => {
    authorized = true
    primaryHost = 'inspur'
    expect((await app.inject({ method: 'POST', url: '/vms/internal/remote-vm/start' })).statusCode).toBe(409)
    primaryHost = 'ovhcloud'
    active = false
    expect((await app.inject({ method: 'POST', url: '/vms/internal/remote-vm/start' })).statusCode).toBe(404)
    expect(actions).toEqual([])
})

test('rejects an unsupported action', async () => {
    authorized = true
    expect((await app.inject({ method: 'POST', url: '/vms/internal/remote-vm/delete' })).statusCode).toBe(400)
    expect(actions).toEqual([])
})
