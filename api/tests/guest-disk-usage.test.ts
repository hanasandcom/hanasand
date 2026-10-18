import { afterEach, describe, expect, test } from 'bun:test'
import { setLxdRequestForTest } from '../src/utils/vms/lxd.ts'
import { guestRootDiskUsage } from '../src/utils/vms/guestDiskUsage.ts'

const files = [
    '/1.0/instances/metric-test-vm/logs/exec-output/exec-test.stdout',
    '/1.0/instances/metric-test-vm/logs/exec-output/exec-test.stderr',
]
const requests: { path: string, options?: { method?: string, body?: unknown } }[] = []
const originalFetch = globalThis.fetch
let listed = false
let restoreRequest = () => {}

afterEach(() => {
    restoreRequest()
    restoreRequest = () => {}
    globalThis.fetch = originalFetch
    requests.length = 0
    listed = false
})

describe('guest VM disk metrics', () => {
    test('reads df output through LXD and removes recorded output files', async() => {
        restoreRequest = setLxdRequestForTest(async<T>(path, options = {}) => {
            requests.push({ path, options })
            let metadata: unknown = {}
            if (path.endsWith('/logs/exec-output')) metadata = listed ? files : (listed = true, [])
            if (path.endsWith('/exec')) return { status_code: 200, status: 'Success', metadata: {}, operation: '/1.0/operations/exec-test' }
            if (path.endsWith('/wait?timeout=20')) metadata = { status: 'Success', metadata: { output: { '1': files[0], '2': files[1] }, return: 0 } }
            return { status_code: 200, status: 'Success', metadata: metadata as T }
        })
        globalThis.fetch = (async() => new Response('Filesystem 1-blocks Used Available Capacity Mounted on\n/dev/sda1 3045871616 1836478464 1192615936 61% /')) as typeof fetch

        await expect(guestRootDiskUsage('metric-test-vm')).resolves.toBe(1_836_478_464)
        expect(requests.find(request => request.path.endsWith('/exec'))?.options?.body).toMatchObject({
            command: ['df', '-B1', '-P', '/'],
            environment: { LC_ALL: 'C' },
            'record-output': true,
        })
        expect(requests.filter(request => request.options?.method === 'DELETE').map(request => request.path)).toEqual(files)
    })
})
