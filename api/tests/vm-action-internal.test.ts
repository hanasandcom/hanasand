import { afterAll, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let instanceMissing = false
let host = 'inspur'
const actions: string[] = []

mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur', vm_api_token: 'test-token' } }))
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [{ primary_host: host }] }) }))
mock.module('../src/utils/vms/lxd.ts', () => ({
    canUseLocalLxd: async () => true,
    getLocalLxdInstance: async () => {
        if (instanceMissing) throw new Error('Instance not found')
        return { status: 'Stopped' }
    },
    setLocalLxdInstanceState: async (_name: string, action: string) => {
        actions.push(action)
        return { status: action === 'stop' ? 'stopped' : 'running' }
    },
}))

const { default: actionInternalVm } = await import('../src/handlers/vms/actionInternal.ts')
const app = Fastify()
app.post('/vms/internal/:name/:action', actionInternalVm)
afterAll(async () => { await app.close() })

test('internal VM action requires the service token and assigned host', async () => {
    const noToken = await app.inject({ method: 'POST', url: '/vms/internal/hei2/start' })
    expect(noToken.statusCode).toBe(401)
    host = 'ovhcloud'
    const wrongHost = await app.inject({ method: 'POST', url: '/vms/internal/hei2/start', headers: { authorization: 'Bearer test-token' } })
    expect(wrongHost.statusCode).toBe(409)
    expect(actions).toHaveLength(0)
    host = 'inspur'
})

test('missing host instance reports the actual start blocker without creating a VM', async () => {
    instanceMissing = true
    const response = await app.inject({ method: 'POST', url: '/vms/internal/hei2/start', headers: { authorization: 'Bearer test-token' } })
    expect(response.statusCode).toBe(404)
    expect(response.json().error).toContain('instance is missing')
    expect(actions).toHaveLength(0)
    instanceMissing = false
})

test('internal VM action operates on the assigned host', async () => {
    const response = await app.inject({ method: 'POST', url: '/vms/internal/hei2/start', headers: { authorization: 'Bearer test-token' } })
    expect(response.statusCode).toBe(200)
    expect(response.json().status).toBe('running')
    expect(actions).toEqual(['start'])
})
