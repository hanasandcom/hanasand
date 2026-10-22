import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { resolveVmHostId } from '../src/utils/vms/hostConfig.ts'

const calls: Array<{ host: string; path: string; method?: string; body?: BodyInit | null }> = []
const databaseCalls: Array<{ sql: string; params: unknown[] }> = []
let existingVm: Record<string, unknown> | undefined
let failedProvisionRequests = 0
let queuedProvisionResponses: Response[] = []
let queuedStatusResponses: Response[] = []
let deferStatusResponse = false
let releaseStatusResponse: (() => void) | undefined
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async (req: any) => ({ valid: req.headers.id === 'admin' }) }))
mock.module('../src/utils/auth/internalToken.ts', () => ({ default: () => false }))
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work(),
    default: async (sql: string, params: unknown[] = []) => {
        databaseCalls.push({ sql, params })
        return {
            rows: /SELECT name, owner, created_by, access_users, primary_host, organization_id, deleted_at/.test(sql)
                ? (existingVm ? [existingVm] : [])
                : /SELECT o\.id\s+FROM organizations/.test(sql)
                    ? (params[0] === 'approved-org' ? [{ id: params[0] }] : [])
                    : /UPDATE vms\s+SET name/.test(sql)
                        ? [{ ...existingVm, name: params[0], owner: params[1], created_by: params[2], access_users: [], primary_host: params[5] }]
                        : /UPDATE vms SET primary_host/.test(sql)
                            ? [existingVm = { ...existingVm, name: params[0], primary_host: params[1] }]
                            : /INSERT INTO vms/.test(sql)
                                ? [existingVm = { name: params[0], owner: params[1], created_by: params[2], access_users: [], ...(params[4] ? { organization_id: params[4] } : {}), primary_host: 'ovhcloud', has_vm_details: false }]
                                : [],
        }
    },
}))
mock.module('../src/utils/vms/hostTransport.ts', () => ({
    internalHostFetch: async (host: string, path: string, options?: RequestInit) => {
        calls.push({ host, path, method: options?.method, body: options?.body })
        if (failedProvisionRequests > 0) {
            failedProvisionRequests--
            return Response.json({ error: 'Temporary host failure.' }, { status: 502 })
        }
        if (path.endsWith('/status')) {
            const response = queuedStatusResponses.shift() ?? Response.json({ status: 'Running' })
            if (deferStatusResponse) await new Promise<void>(resolve => { releaseStatusResponse = resolve })
            return response
        }
        if (path.endsWith('/provision')) {
            return queuedProvisionResponses.shift() ?? Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })
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
beforeEach(() => { calls.length = 0; databaseCalls.length = 0; existingVm = undefined; failedProvisionRequests = 0; queuedProvisionResponses = []; queuedStatusResponses = []; deferStatusResponse = false; releaseStatusResponse = undefined })
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
    expect(calls.filter(call => call.path.endsWith('/provision'))).toEqual([{ host: 'inspur', path: '/vms/internal/remote-vm/provision', method: 'POST', body: JSON.stringify({ os: 'ubuntu-24.04', resources: { cpu: '1', memory: '2GiB', disk: '10GiB' }, services: [], minecraftEulaAccepted: false }) }])
})

test('VM creation forwards the selected OS and services to its assigned host', async () => {
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'remote-vm', os: 'ubuntu-22.04', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services: ['nodejs', 'redis'] },
    })
    expect(response.statusCode).toBe(201)
    expect(calls[0]).toMatchObject({
        host: 'inspur', path: '/vms/internal/remote-vm/provision', method: 'POST',
        body: JSON.stringify({ os: 'ubuntu-22.04', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services: ['nodejs', 'redis'], minecraftEulaAccepted: false }),
    })
})

test('VM creation forwards Ubuntu 26.04 LTS', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', os: 'ubuntu-26.04' } })
    expect(response.statusCode).toBe(201)
    expect(calls[0]?.body).toBe(JSON.stringify({ os: 'ubuntu-26.04', resources: { cpu: '1', memory: '2GiB', disk: '10GiB' }, services: [], minecraftEulaAccepted: false }))
})

test('VM creation forwards Ubuntu Desktop and requires at least 4 GiB', async () => {
    const tooSmall = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'desktop-vm', os: 'ubuntu-24.04-desktop' } })
    expect(tooSmall.statusCode).toBe(400)
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'desktop-vm', os: 'ubuntu-24.04-desktop', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' } },
    })
    expect(response.statusCode).toBe(201)
    expect(calls.find(call => call.path.endsWith('/provision'))?.body).toBe(JSON.stringify({ os: 'ubuntu-24.04-desktop', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services: [], minecraftEulaAccepted: false }))
})



test('VM creation accepts and forwards every listed service', async () => {
    const services = ['nodejs', 'bun', 'python', 'java', 'go', 'php', 'docker', 'postgresql', 'mysql', 'sqlite', 'redis', 'nginx', 'website', 'minecraft-java']
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'remote-vm', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services, minecraft_eula_accepted: true, minecraft_server_type: 'NEOFORGE' },
    })
    expect(response.statusCode).toBe(201)
    expect(calls[0]?.body).toBe(JSON.stringify({ os: 'ubuntu-24.04', resources: { cpu: '2', memory: '4GiB', disk: '20GiB' }, services, minecraftEulaAccepted: true, minecraftServerType: 'NEOFORGE' }))

    const invalid = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'remote-vm', services: [...services, 'unknown'] },
    })
    expect(invalid.statusCode).toBe(400)

    const missingEula = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', services: ['minecraft-java'] } })
    expect(missingEula.statusCode).toBe(400)
    const unsupportedMinecraftType = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', services: ['minecraft-java'], minecraft_eula_accepted: true, minecraft_server_type: 'CUSTOM' } })
    expect(unsupportedMinecraftType.statusCode).toBe(400)
    const undersizedMinecraftVm = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', resources: { cpu: '1', memory: '2GiB', disk: '10GiB' }, services: ['minecraft-java'], minecraft_eula_accepted: true } })
    expect(undersizedMinecraftVm.statusCode).toBe(400)
})

test('AI website content is escaped before it crosses the authenticated host boundary', async () => {
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: {
            name: 'remote-vm', services: ['website'],
            website: { title: '<script>alert(1)</script>', tagline: 'A & B', sections: [{ heading: 'Hello', body: 'Safe <b>text</b>' }] },
        },
    })
    expect(response.statusCode).toBe(201)
    const forwarded = JSON.parse(String(calls[0]?.body))
    expect(forwarded.websiteHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(forwarded.websiteHtml).toContain('A &amp; B')
    expect(forwarded.websiteHtml).not.toContain('<script>')
    const routeInsert = databaseCalls.find(call => call.sql.includes('INSERT INTO vm_public_ports'))
    expect(routeInsert?.params[0]).toBe('remote-vm')
    expect(String(routeInsert?.params[1])).toMatch(/^site-[a-f0-9]{16}$/)
    expect(routeInsert?.params.slice(2)).toEqual(['http', 80, 'member'])

    const invalid = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: { name: 'remote-vm', services: ['website'], website: { title: 'x'.repeat(121), tagline: '', sections: [] } },
    })
    expect(invalid.statusCode).toBe(400)
})

test('Minecraft setup creates its port-443 public route with the guest server port', async () => {
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'member' },
        payload: {
            name: 'survival', organization_id: null,
            resources: { cpu: '2', memory: '4GiB', disk: '20GiB' },
            services: ['minecraft-java'], minecraft_eula_accepted: true,
        },
    })

    expect(response.statusCode).toBe(201)
    const routeInsert = databaseCalls.find(call => call.sql.includes('INSERT INTO vm_public_ports'))
    expect(routeInsert?.params).toEqual(['survival', expect.stringMatching(/^mc-[a-f0-9]{16}$/), 'minecraft-java', 25565, 'member'])
    expect(calls[0]?.body).toContain('"minecraftServerType":"PAPER"')
})

test('VM creation rejects unsupported resource limits and forwards an allowed size', async () => {
    const invalid = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', resources: { cpu: '96', memory: '1TiB' } } })
    expect(invalid.statusCode).toBe(400)
    expect(calls).toHaveLength(0)

    const accepted = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', resources: { cpu: '4', memory: '8GiB', disk: '40GiB' } } })
    expect(accepted.statusCode).toBe(201)
    expect(calls[0]?.body).toBe(JSON.stringify({ os: 'ubuntu-24.04', resources: { cpu: '4', memory: '8GiB', disk: '40GiB' }, services: [], minecraftEulaAccepted: false }))
})

test('VM creation returns while the accepted host provision job is still running', async () => {
    queuedProvisionResponses = [Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })]
    queuedStatusResponses = [Response.json({ status: 'Provisioning' })]
    deferStatusResponse = true

    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    await waitFor(() => calls.some(call => call.path.endsWith('/status')))
    expect(calls.map(call => call.path)).toContain('/vms/internal/remote-vm/provision')
    releaseStatusResponse?.()
})

test('administrator creation returns while host provisioning is still pending', async () => {
    queuedProvisionResponses = [Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })]
    queuedStatusResponses = [Response.json({ status: 'Provisioning' })]
    deferStatusResponse = true

    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'admin' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(201)
    await waitFor(() => calls.some(call => call.path.endsWith('/status')))
    releaseStatusResponse?.()
})

test('organization VM creation checks owner or admin membership and saves the selected organization', async () => {
    const denied = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'org-vm', organization_id: 'other-org' } })
    expect(denied.statusCode).toBe(403)
    expect(databaseCalls.every(call => !/INSERT INTO vms/.test(call.sql))).toBe(true)

    databaseCalls.length = 0
    const accepted = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'org-vm', organization_id: 'approved-org' } })
    expect(accepted.statusCode).toBe(201)
    expect(accepted.json().organization_id).toBe('approved-org')
    expect(databaseCalls.find(call => /INSERT INTO vms/.test(call.sql))?.sql).toContain('organization_id')
    expect(databaseCalls.find(call => /INSERT INTO vms/.test(call.sql))?.params).toEqual(['org-vm', 'member', 'member', '[]', 'approved-org'])
})

test('VM creation reports a host queue failure instead of claiming setup was started', async () => {
    queuedProvisionResponses = [Response.json({ name: 'remote-vm', status: 'Provisioning' }, { status: 202 })]
    queuedStatusResponses = [Response.json({ status: 'Error' })]
    failedProvisionRequests = 1

    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ error: 'The VM host could not start this setup. Try again in a moment.' })
    expect(calls).toHaveLength(1)
})

test('metadata-only VM creation skips host provisioning when explicitly requested', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm', provision_local: false } })

    expect(response.statusCode).toBe(201)
    expect(calls).toEqual([])
})

test('owner can retry provisioning after a failed first create without duplicating the VM row', async () => {
    failedProvisionRequests = 1
    const first = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })
    expect(first.statusCode).toBe(503)
    expect(existingVm).toMatchObject({ name: 'remote-vm', owner: 'member', primary_host: 'inspur', has_vm_details: false })

    const retry = await app.inject({ method: 'POST', url: '/vm', headers: { id: 'member' }, payload: { name: 'remote-vm' } })

    expect(retry.statusCode).toBe(201)
    expect(retry.json().primary_host).toBe('inspur')
    expect(calls.filter(call => call.path.endsWith('/provision'))).toHaveLength(2)
    expect(calls.filter(call => call.path.endsWith('/provision')).every(call => call.path === '/vms/internal/remote-vm/provision')).toBe(true)
})

test('admin metadata updates preserve the VM primary host and route provisioning there', async () => {
    existingVm = { name: 'prior-vm', owner: 'old-owner', created_by: 'old-owner', access_users: [], primary_host: 'inspur', deleted_at: null }
    const response = await app.inject({
        method: 'POST', url: '/vm', headers: { id: 'admin' },
        payload: { name: 'prior-vm', owner: 'new-owner', created_by: 'admin' },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().primary_host).toBe('inspur')
    expect(calls.filter(call => call.path.endsWith('/provision'))).toEqual([{ host: 'inspur', path: '/vms/internal/prior-vm/provision', method: 'POST', body: JSON.stringify({ os: 'ubuntu-24.04', resources: { cpu: '1', memory: '2GiB', disk: '10GiB' }, services: [], minecraftEulaAccepted: false }) }])
})
