import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let authorized = false
let host = 'ovhcloud'
let vm: { primary_host: string | null } | undefined = { primary_host: 'ovhcloud' }
let status: { status: string } = { status: 'Running' }
let reads = 0
mock.module('../src/constants.ts', () => ({ default: { get vm_host_id() { return host } } }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => authorized }))
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: vm ? [vm] : [] }) }))
mock.module('../src/utils/vms/status.ts', () => ({ localVmStatus: async () => { reads++; return status } }))
mock.module('../src/utils/vms/hostTransport.ts', () => ({ supportedHost: (value: string) => ['inspur', 'ovhcloud'].includes(value) }))
const { default: getInternalVmStatus } = await import('../src/handlers/vms/statusInternal.ts')
const app = Fastify()
app.get('/vms/internal/:name/status', getInternalVmStatus)
beforeEach(() => { authorized = false; host = 'ovhcloud'; vm = { primary_host: 'ovhcloud' }; status = { status: 'Running' }; reads = 0 })
afterAll(async () => { await app.close() })

test('internal status requires service auth before querying the VM', async () => {
    expect((await app.inject({ method: 'GET', url: '/vms/internal/vm-one/status' })).statusCode).toBe(401)
    expect(reads).toBe(0)
})

test('reports live status only for an active VM assigned to this host', async () => {
    authorized = true
    const response = await app.inject({ method: 'GET', url: '/vms/internal/vm-one/status' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'Running' })
    vm = { primary_host: 'inspur' }
    expect((await app.inject({ method: 'GET', url: '/vms/internal/vm-one/status' })).statusCode).toBe(409)
    vm = undefined
    expect((await app.inject({ method: 'GET', url: '/vms/internal/vm-one/status' })).statusCode).toBe(404)
    expect(reads).toBe(1)
})
