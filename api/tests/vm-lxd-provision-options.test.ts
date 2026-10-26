import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'

const calls: Array<{ path: string, options?: { method?: string; body?: unknown } }> = []
let created: Record<string, unknown> | undefined
mock.module('../src/constants.ts', () => ({ default: { lxd_image_server: 'https://images.example', lxd_image_alias: '24.04', lxd_socket_path: '/tmp/lxd.sock' } }))
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [] }) }))

const { lxdProjectPath, provisionLocalLxdInstance, setLxdRequestForTest, setVmDetailsWriterForTest } = await import('../src/utils/vms/lxd.ts')
const { waitForLxdOperation } = await import('../src/utils/vms/lxdOperations.ts')
const resetRequest = setLxdRequestForTest(async (path, options) => {
    calls.push({ path, options })
    if (path.startsWith('/1.0/instances/') && path.endsWith('/state') && options?.method === 'PUT') {
        return { status_code: 200, status: 'Success', metadata: {}, operation: '/1.0/operations/start' }
    }
    if (path === '/1.0/profiles/default') return { status_code: 200, status: 'Success', metadata: { devices: { root: { type: 'disk', path: '/', pool: 'test-pool' } } } }
    if (path.startsWith('/1.0/instances/') && path.endsWith('/state')) {
        return { status_code: 200, status: 'Success', metadata: { status: 'Running' } }
    }
    if (path.startsWith('/1.0/instances/')) {
        if (!created) throw new Error('LXD returned 404')
        return { status_code: 200, status: 'Success', metadata: created }
    }
    if (path === '/1.0/instances' && options?.method === 'POST') {
        const body = options.body as Record<string, unknown>
        created = { name: body.name, status: 'Running', config: body.config, devices: {}, profiles: ['default'], architecture: 'x86_64' }
        return { status_code: 202, status: 'Accepted', metadata: {}, operation: '/1.0/operations/create' }
    }
    if (path.includes('/1.0/operations/')) return { status_code: 200, status: 'Success', metadata: {} }
    return { status_code: 200, status: 'Success', metadata: { pending: [], running: [] } }
})
const resetWriter = setVmDetailsWriterForTest(async () => {})
beforeEach(() => { calls.length = 0; created = undefined })
afterAll(() => { resetRequest(); resetWriter() })

test('LXD project scoping preserves other query parameters and replaces stale project values', () => {
    expect(lxdProjectPath('/1.0/instances?recursion=1', 'hanasand-vm-stage')).toBe('/1.0/instances?recursion=1&project=hanasand-vm-stage')
    expect(lxdProjectPath('/1.0/instances/foo?project=default', 'hanasand-vm-stage')).toBe('/1.0/instances/foo?project=hanasand-vm-stage')
    expect(lxdProjectPath('/1.0/instances/foo', '')).toBe('/1.0/instances/foo')
})

test('LXD project scoping is retained when waiting on an operation URL', async () => {
    let requestedPath = ''
    await waitForLxdOperation(async path => {
        requestedPath = path
        return { status_code: 200, status: 'Success', metadata: {} }
    }, '/1.0/operations/example?project=hanasand-vm-stage', 30)
    expect(requestedPath).toBe('/1.0/operations/example/wait?project=hanasand-vm-stage&timeout=30')
})

test.serial('LXD creates a full VM with the selected resources, Docker setup, and cloud-init user data', async () => {
    await provisionLocalLxdInstance('configured-vm', {
        os: 'ubuntu-26.04',
        resources: { cpu: '4', memory: '8GiB', disk: '40GiB' },
        services: ['nodejs', 'docker'],
        aptPackages: ['ripgrep'],
    })

    const create = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')
    const body = create?.options?.body as { type: string; config: Record<string, string>; devices: Record<string, { pool: string; size: string }>; source: { alias: string } }
    expect(body.type).toBe('virtual-machine')
    expect(body.source.alias).toBe('26.04')
    expect(body.config['limits.cpu']).toBe('4')
    expect(body.config['limits.memory']).toBe('8GiB')
    expect(body.devices.root.size).toBe('40GiB')
    expect(body.devices.root.pool).toBe('test-pool')
    expect(body.config['security.nesting']).toBeUndefined()
    expect(body.config['security.syscalls.intercept.mknod']).toBeUndefined()
    expect(body.config['security.syscalls.intercept.setxattr']).toBeUndefined()
    expect(body.config['user.hanasand.setup_plan']).toMatch(/^[a-f0-9]{64}$/)
    expect(body.config['user.hanasand.setup_plan']).toBe(createHash('sha256').update(JSON.stringify({ os: 'ubuntu-26.04', resources: { cpu: '4', memory: '8GiB', disk: '40GiB' }, services: ['docker', 'nodejs'], aptPackages: ['ripgrep'] })).digest('hex'))
    expect(body.config['cloud-init.user-data']).toContain('https://nodejs.org/dist/')
    expect(body.config['cloud-init.user-data']).toContain('SHASUMS256.txt')
    expect(body.config['cloud-init.user-data']).toContain('apt_packages+=( \'ripgrep\' )')
})

test.serial('Rocky Linux uses its supported image alias and installs Docker and Nginx with DNF', async () => {
    await provisionLocalLxdInstance('rocky-vm', {
        os: 'rocky-9',
        resources: { cpu: '5', memory: '10GiB', disk: '40GiB' },
        services: ['docker', 'nginx', 'website'],
        websiteHtml: '<!doctype html><title>Hei</title>',
    })

    const body = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')?.options?.body as {
        config: Record<string, string>
        source: { server: string; alias: string }
    }
    expect(body.source).toMatchObject({ server: 'https://images.lxd.canonical.com', alias: 'rockylinux/9/cloud' })
    expect(body.config['limits.cpu']).toBe('5')
    expect(body.config['limits.memory']).toBe('10GiB')
    expect(body.config['cloud-init.user-data']).toContain('docker_rpm_release=rhel')
    expect(body.config['cloud-init.user-data']).toContain('docker_rpm_release=fedora')
    expect(body.config['cloud-init.user-data']).toContain('dnf install -y')
    expect(body.config['cloud-init.user-data']).toContain('/usr/share/nginx/html/index.html')
    expect(body.config['cloud-init.user-data']).toContain('if [[ \'true\' == \'true\' ]]')
})

test.serial('Kali, Fedora Server, and AlmaLinux use published cloud image aliases', async () => {
    await provisionLocalLxdInstance('kali-vm', { os: 'kali', services: ['docker'] })
    const kali = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')?.options?.body as { source: { server: string; alias: string } }
    expect(kali.source).toMatchObject({ server: 'https://images.lxd.canonical.com', alias: 'kali/current/cloud' })

    calls.length = 0
    created = undefined
    await provisionLocalLxdInstance('fedora-vm', { os: 'fedora-44', services: ['docker'] })
    const fedora = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')?.options?.body as { source: { server: string; alias: string } }
    expect(fedora.source).toMatchObject({ server: 'https://images.lxd.canonical.com', alias: 'fedora/44/cloud' })

    calls.length = 0
    created = undefined
    await provisionLocalLxdInstance('alma-vm', { os: 'almalinux-9', services: ['postgresql'] })
    const alma = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')?.options?.body as { source: { server: string; alias: string } }
    expect(alma.source).toMatchObject({ server: 'https://images.lxd.canonical.com', alias: 'almalinux/9/cloud' })
})

test.serial('LXD applies a valid custom CPU and memory allocation to the instance limits', async () => {
    await provisionLocalLxdInstance('custom-vm', {
        os: 'ubuntu-24.04',
        resources: { cpu: '10', memory: '64GiB', disk: '100GiB' },
        services: [],
    })

    const body = calls.find(call => call.path === '/1.0/instances' && call.options?.method === 'POST')?.options?.body as {
        config: Record<string, string>
        devices: Record<string, { size: string }>
    }
    expect(body.config['limits.cpu']).toBe('10')
    expect(body.config['limits.memory']).toBe('64GiB')
    expect(body.devices.root.size).toBe('100GiB')
})

test.serial('empty AI package lists keep the existing setup hash stable', async () => {
    const options = { os: 'ubuntu-24.04' as const, resources: { cpu: '2' as const, memory: '4GiB' as const, disk: '20GiB' as const }, services: ['nodejs' as const, 'postgresql' as const] }
    const legacyHash = createHash('sha256').update(JSON.stringify({ ...options, services: [...options.services].sort() })).digest('hex')
    created = { name: 'configured-vm', status: 'Running', config: { 'user.hanasand.setup_plan': legacyHash }, devices: {}, profiles: ['default'] }

    await provisionLocalLxdInstance('configured-vm', { ...options, aptPackages: [] })
    expect(calls.some(call => call.path === '/1.0/instances/configured-vm' && call.options?.method === 'PATCH')).toBe(false)
})

test.serial('an existing VM rejects a different provisioning plan instead of silently ignoring it', async () => {
    created = { name: 'configured-vm', status: 'Running', config: { 'user.hanasand.setup_plan': 'old-plan' }, devices: {}, profiles: ['default'] }

    await expect(provisionLocalLxdInstance('configured-vm', { os: 'ubuntu-24.04', resources: { cpu: '1', memory: '2GiB', disk: '10GiB' }, services: [] }))
        .rejects.toThrow('different setup plan')
})

test.serial('an existing VM without setup metadata reports selected services as an error', async () => {
    created = { name: 'configured-vm', status: 'Running', config: {}, devices: {}, profiles: ['default'] }
    const response = await provisionLocalLxdInstance('configured-vm', { services: ['nodejs'] }).catch(error => error as Error)

    expect(response.message).toContain('cannot apply the selected services')
    expect(calls.some(call => call.path === '/1.0/instances/configured-vm/state' && call.options?.method === 'PUT')).toBe(false)
    expect(calls.find(call => call.path === '/1.0/instances/configured-vm' && call.options?.method === 'PATCH')?.options?.body).toMatchObject({
        config: { 'user.hanasand.provisioning_state': expect.stringContaining('cannot apply the selected services') },
    })
})
