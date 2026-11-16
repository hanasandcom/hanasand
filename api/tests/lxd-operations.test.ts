import { expect, test } from 'bun:test'
import { waitForInstanceOperations, waitForLxdOperation } from '../src/utils/vms/lxdOperations.ts'

function response<T>(metadata: T) {
    return { status_code: 200, status: 'Success', metadata }
}

test('operation waits accept LXD URLs, encode IDs, and skip missing operation references', async () => {
    const paths: string[] = []
    const request = async <T>(path: string) => {
        paths.push(path)
        return response({ status_code: 200, status: 'Success' } as T)
    }

    await waitForLxdOperation(request, 'https://lxd/1.0/operations/already%20encoded', 30)
    await waitForLxdOperation(request, 'raw operation id', 45)
    await waitForLxdOperation(request, undefined, 60)

    expect(paths).toEqual([
        '/1.0/operations/already%20encoded/wait?timeout=30',
        '/1.0/operations/raw%20operation%20id/wait?timeout=45',
    ])
})

test('instance waits include matching create-like operations and ignore unrelated work', async () => {
    const paths: string[] = []
    let listCalls = 0
    const request = async <T>(path: string) => {
        paths.push(path)
        if (path === '/1.0/operations?recursion=1') {
            listCalls++
            const metadata = listCalls === 1 ? {
                pending: [
                    { id: 'other-instance', description: 'Creating instance', resources: { instances: ['/1.0/instances/other'] } },
                    { id: 'wrong-action', description: 'Starting instance', resources: { instances: ['/1.0/instances/target%20vm'] } },
                ],
                running: [
                    { id: 'target-create', description: 'Copying instance', resources: { instances: ['/1.0/instances/target%20vm'] } },
                ],
            } : { pending: [], running: [] }
            return response(metadata as T)
        }
        return response({ status_code: 200, status: 'Success' } as T)
    }

    await waitForInstanceOperations(request, 'target vm', 2)
    expect(paths).toEqual([
        '/1.0/operations?recursion=1',
        '/1.0/operations/target-create/wait?timeout=2',
        '/1.0/operations?recursion=1',
    ])
})

test('operation waits for terminal success and reports the LXD failure', async () => {
    const paths: string[] = []
    const request = async <T>(path: string) => {
        paths.push(path)
        return response((paths.length === 1
            ? { status_code: 103, status: 'Running' }
            : { status_code: 200, status: 'Success' }) as T)
    }
    await waitForLxdOperation(request, 'create-vm', 2)
    expect(paths).toHaveLength(2)

    await expect(waitForLxdOperation(async () => response({
        status_code: 400, status: 'Failure', err: 'Project limits.virtual-machines reached',
    }), 'create-vm', 2)).rejects.toThrow('Project limits.virtual-machines reached')
})

test('instance wait does not treat a failed operation-list request as idle', async () => {
    await expect(waitForInstanceOperations(async () => {
        throw new Error('LXD is unavailable')
    }, 'target', 2)).rejects.toThrow('LXD is unavailable')
})
