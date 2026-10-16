import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
const vmNames = ['cashflow', 'database']
let internalTokenAuthorized = true

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        queries.push({ sql, params })
        if (sql === 'SELECT name FROM vms;') return { rows: vmNames.map(name => ({ name })) }
        return { rows: [{ name: 'vm-details-row' }] }
    },
}))
mock.module('#utils/auth/internalToken.ts', () => ({ default: () => internalTokenAuthorized }))

const { default: postVMDetails } = await import('../src/handlers/vms/postVMDetails.ts')
const { default: getVMNames } = await import('../src/handlers/vms/getNames.ts')
const { refreshLocalLxdDetails, setLxdRequestForTest } = await import('../src/utils/vms/lxd.ts')

const app = Fastify()
app.post('/vm-details', postVMDetails)
app.get('/vms/names', getVMNames)
beforeEach(() => {
    queries.length = 0
    vmNames.splice(0, vmNames.length, 'cashflow', 'database')
    internalTokenAuthorized = true
})
afterAll(() => app.close())

function postBody() {
    return {
        name: 'posted-vm', status: 'RUNNING', type: 'container', architecture: 'x86_64',
        created: 'created', last_used: 'used', config_architecture: 'arm64',
        config_image_architecture: 'image-architecture', config_image_description: 'description',
        config_image_label: 'label', config_image_os: 'linux', config_image_release: 'release',
        config_image_serial: 'serial', config_image_type: 'image-type', config_image_version: 'version',
        limits_cpu: '2', limits_memory: '2GiB', volatile_base_image: 'base-image',
        volatile_cloud_init_instance_id: 'instance-id', volatile_eth0_hwaddr: '00:00:00:00:00:01',
        volatile_last_state_power: 'RUNNING', volatile_uuid: 'uuid', volatile_uuid_generation: 'generation',
        volatile_vsock_id: 'vsock', device_eth0_ipv4_address: '192.0.2.2', device_eth0_name: 'eth0',
        device_eth0_network: 'br0', device_eth0_type: 'nic', ephemeral: 'true', stateful: 'false',
        description: 'vm description', profiles: ['default'],
    }
}

function upsertCall() {
    const call = queries.find(query => query.sql.includes('INSERT INTO vm_details'))
    expect(call).toBeDefined()
    expect(call?.sql).toContain('ON CONFLICT (name) DO UPDATE SET')
    expect(call?.sql).toContain('RETURNING *')
    expect(call?.params).toHaveLength(33)
    return call!
}

test('internal VM details endpoint preserves input conversions, order, timestamp, and returned row', async () => {
    const response = await app.inject({ method: 'POST', url: '/vm-details', payload: postBody() })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({ name: 'vm-details-row' })

    const { params } = upsertCall()
    expect(params.slice(0, 6)).toEqual(['posted-vm', 'RUNNING', 'container', 'x86_64', 'created', 'used'])
    expect(params.slice(6, 28)).toEqual([
        'arm64', 'image-architecture', 'description', 'label', 'linux', 'release', 'serial',
        'image-type', 'version', '2', '2GiB', 'base-image', 'instance-id', '00:00:00:00:00:01',
        'RUNNING', 'uuid', 'generation', 'vsock', '192.0.2.2', 'eth0', 'br0', 'nic',
    ])
    expect(params[28]).toBe(true)
    expect(params[29]).toBe(false)
    expect(params.slice(30, 32)).toEqual(['vm description', ['default']])
    expect(Date.parse(String(params[32]))).not.toBeNaN()
})

test('internal VM details endpoint rejects missing fields before writing', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/vm-details',
        payload: { ...postBody(), name: undefined, profiles: null },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Missing required fields: name, profiles' })
    expect(queries).toHaveLength(0)
})

test('internal VM names endpoint returns names and an empty list for an empty inventory', async () => {
    const names = await app.inject('/vms/names')
    expect(names.statusCode).toBe(200)
    expect(names.json()).toEqual(['cashflow', 'database'])

    vmNames.length = 0
    const empty = await app.inject('/vms/names')
    expect(empty.statusCode).toBe(200)
    expect(empty.json()).toEqual([])
    expect(queries).toHaveLength(2)
    expect(queries.every(query => query.sql === 'SELECT name FROM vms;' && query.params.length === 0)).toBe(true)
})

test('internal VM names endpoint rejects an invalid internal token before querying', async () => {
    internalTokenAuthorized = false
    const response = await app.inject('/vms/names')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized.' })
    expect(queries).toHaveLength(0)
})

test('LXD refresh uses the same persistence writer and retains mapped inventory values', async () => {
    const restoreRequest = setLxdRequestForTest(async <T>(path: string) => {
        const metadata = path.endsWith('/state')
            ? { status: 'Running', network: {} }
            : {
                name: 'cashflow', status: 'Running', architecture: 'x86_64', created_at: 'created',
                last_used_at: 'used', config: { 'limits.cpu': '4', 'limits.memory': '4GiB' },
                expanded_devices: { eth0: { name: 'eth0', network: 'br0', type: 'nic', 'ipv4.address': '192.0.2.5' } },
                profiles: ['default'], description: 'from LXD', ephemeral: true, stateful: false,
            }
        return { status_code: 200, status: 'Success', metadata: metadata as T }
    })

    try {
        const details = await refreshLocalLxdDetails('cashflow', true)
        expect(details.device_eth0_ipv4_address).toBe('192.0.2.5')
        expect(details.device_eth0_name).toBe('eth0')
        const { params } = upsertCall()
        expect(params.slice(0, 6)).toEqual(['cashflow', 'Running', 'container', 'x86_64', 'created', 'used'])
        expect(params[28]).toBe(true)
        expect(params[29]).toBe(false)
        expect(params[31]).toEqual(['default'])
        expect(Date.parse(String(params[32]))).not.toBeNaN()
    } finally {
        restoreRequest()
    }
})
