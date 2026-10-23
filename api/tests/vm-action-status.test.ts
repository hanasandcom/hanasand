import { expect, mock, test } from 'bun:test'

let hostStatus = 'Stopped'
const responseStatus = 'Running'
let hostTransportError: Error | undefined
mock.module('../src/constants.ts', () => ({ default: { vm_host_id: 'inspur', lxd_socket_path: '/tmp/lxd.sock' } }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner' }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('../src/utils/vms/access.ts', () => ({ hasVmAccess: async () => true }))
mock.module('../src/utils/vms/lifecycleLock.ts', () => ({ vmLifecycleLock: async (_name: string, work: () => Promise<unknown>) => work() }))
mock.module('../src/utils/vms/lxd.ts', () => ({
    getLocalLxdInstance: async () => ({ config: {} }),
    lxdProjectPath: (path: string) => path,
    updateLocalLxdConfig: async () => {},
}))
mock.module('../src/utils/sanitize.ts', () => ({ default: (value: string) => value }))
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string) => ({ rows: sql.includes('FROM vms') ? [{
    name: 'status-cache-regression-vm', owner: 'owner', created_by: 'owner', access_users: [], primary_host: 'inspur', deleted_at: null,
}] : [] }) }))
mock.module('../src/utils/vms/hostTransport.ts', () => ({ internalHostFetch: async () => {
    if (hostTransportError) throw hostTransportError
    hostStatus = responseStatus
    return Response.json({ message: 'start command completed' })
} }))
mock.module('../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => undefined }))

const { withLiveVmStatus } = await import('../src/utils/vms/status.ts')
const { default: vmAction } = await import('../src/handlers/vms/action.ts')

test('successful lifecycle actions invalidate cached host status before the next page read', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({ metadata: { status: hostStatus } })) as typeof fetch
    try {
        const vm = { name: 'status-cache-regression-vm', status: 'STOPPED' }
        expect((await withLiveVmStatus(vm)).status).toBe('STOPPED')

        const reply = {
            statusCode: 200,
            body: undefined as unknown,
            status(code: number) { this.statusCode = code; return this },
            send(body: unknown) { this.body = body; return this },
        }
        await vmAction({ params: { id: vm.name, action: 'start' } } as never, reply as never)
        expect(reply.statusCode).toBe(200)
        expect((await withLiveVmStatus(vm)).status).toBe('RUNNING')
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('lifecycle transport timeouts return an actionable gateway timeout', async () => {
    hostTransportError = new Error('Request timed out')
    const reply = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) { this.statusCode = code; return this },
        send(body: unknown) { this.body = body; return this },
    }
    try {
        await vmAction({
            params: { id: 'status-cache-regression-vm', action: 'restart' },
            log: { error: () => undefined },
        } as never, reply as never)
        expect(reply.statusCode).toBe(504)
        expect(reply.body).toEqual({ error: 'The restart request timed out. The VM may still be processing it; check its status before trying again.' })
    } finally {
        hostTransportError = undefined
    }
})
