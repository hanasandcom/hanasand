import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { vmLoginUserData } from '../src/utils/vms/vmLoginUserData.ts'

let authorized = false
let host = 'ovhcloud'
let vmRows: Array<{ primary_host: string | null }> = []
let lxdAvailable = true
const queries: Array<{ sql: string, values?: unknown[] }> = []
const provisions: Array<{ name: string, options?: unknown }> = []

mock.module('../src/constants.ts', () => ({ default: { get vm_host_id() { return host } } }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => authorized }))
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values })
        return { rows: vmRows }
    },
}))
mock.module('../src/utils/vms/lxd.ts', () => ({
    canUseLocalLxd: async () => lxdAvailable,
    provisionLocalLxdInstance: async (name: string, options?: unknown) => { provisions.push({ name, options }) },
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    supportedHost: (value: string) => ['inspur', 'ovhcloud'].includes(value),
}))

const { default: provisionInternalVm } = await import('../src/handlers/vms/provisionInternal.ts')
const app = Fastify()
app.post('/vms/internal/:name/provision', provisionInternalVm)

beforeEach(() => {
    authorized = false
    host = 'ovhcloud'
    vmRows = [{ primary_host: 'ovhcloud' }]
    lxdAvailable = true
    queries.length = 0
    provisions.length = 0
})

afterAll(async () => { await app.close() })

test('VM login user data creates a locked shell account and rejects unsafe names', () => {
    expect(vmLoginUserData('codexvm')).toBe('#cloud-config\nhostname: codexvm\nmanage_etc_hosts: true\nusers:\n  - name: codexvm\n    shell: /bin/bash\n    lock_passwd: true\nruncmd:\n  - [sh, -lc, \'grep -Eq "^127\\.0\\.1\\.1[[:space:]]+.*[[:space:]]codexvm([[:space:]]|$)|^127\\.0\\.1\\.1[[:space:]]+codexvm([[:space:]]|$)" /etc/hosts || printf "127.0.1.1 codexvm\\n" >> /etc/hosts\']\n')
    expect(() => vmLoginUserData('root')).toThrow('Invalid VM login account.')
    expect(() => vmLoginUserData('bad name')).toThrow('Invalid VM login account.')
})

test('rejects requests without the internal token before reading or provisioning a VM', async () => {
    const response = await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision' })
    expect(response.statusCode).toBe(401)
    expect(queries).toHaveLength(0)
    expect(provisions).toEqual([])
})

test('rejects invalid names and unsupported local hosts', async () => {
    authorized = true
    expect((await app.inject({ method: 'POST', url: '/vms/internal/Bad%20Name/provision' })).statusCode).toBe(400)
    host = 'unknown'
    expect((await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision' })).statusCode).toBe(503)
    expect(queries).toHaveLength(0)
})

test('rejects a VM assigned to a different host', async () => {
    authorized = true
    vmRows = [{ primary_host: 'inspur' }]
    const response = await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision' })
    expect(response.statusCode).toBe(409)
    expect(provisions).toEqual([])
})

test('rejects missing or deleted VMs using the active-row query', async () => {
    authorized = true
    vmRows = []
    const response = await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision' })
    expect(response.statusCode).toBe(404)
    expect(queries[0]?.sql).toContain('deleted_at IS NULL')
    expect(queries[0]?.values).toEqual(['fixture-vm'])
    expect(provisions).toEqual([])
})

test('reports unavailable local LXD without provisioning', async () => {
    authorized = true
    lxdAvailable = false
    const response = await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision' })
    expect(response.statusCode).toBe(503)
    expect(provisions).toEqual([])
})

test('provisions a VM once when its active primary host matches and supports legacy admin names', async () => {
    authorized = true
    vmRows = [{ primary_host: 'OVHCLOUD' }]
    const response = await app.inject({ method: 'POST', url: '/vms/internal/Admin_VM1/provision' })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true, name: 'Admin_VM1', host: 'ovhcloud' })
    expect(provisions).toEqual([{ name: 'Admin_VM1', options: undefined }])
})

test('forwards the selected operating system, resources, and services to the LXD creator', async () => {
    authorized = true
    const options = { os: 'ubuntu-26.04', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services: ['nodejs', 'postgresql'] }
    const response = await app.inject({ method: 'POST', url: '/vms/internal/fixture-vm/provision', payload: options })

    expect(response.statusCode).toBe(200)
    expect(provisions).toEqual([{ name: 'fixture-vm', options }])
})
