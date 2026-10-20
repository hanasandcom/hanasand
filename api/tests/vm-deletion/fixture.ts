import { beforeEach, mock } from 'bun:test'
import Fastify from 'fastify'

export const day = 86400000
export const state = {
    now: 0,
    vm: null as any,
    instance: null as any,
    failAt: '',
    removed: 0,
    starts: 0,
    operationId: '',
    waitResult: null as any,
    waitCalls: [] as Array<[string | undefined, number]>,
    pendingPatch: null as any,
    waitGate: undefined as Promise<void> | undefined,
    onWaitStarted: undefined as (() => void) | undefined,
}

let tail = Promise.resolve()
const clone = (value: any) => structuredClone(value)

mock.module('../../src/constants.ts', () => ({ default: { vm_host_id: 'inspur' } }))
mock.module('../../src/utils/db.ts', () => ({
    withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => {
        const prior = tail
        let release!: () => void
        tail = new Promise(resolve => { release = resolve })
        await prior
        try { return await work() } finally { release() }
    },
    default: async (sql: string, params: any[] = []) => {
        if (sql.startsWith('SELECT *')) return { rows: state.vm ? [clone(state.vm)] : [] }
        if (sql.startsWith('SELECT name')) {
            const eligible = state.vm && (sql.includes('delete_after <=') ? Date.parse(state.vm.delete_after) <= state.now : sql.includes('delete_after >') ? Date.parse(state.vm.delete_after) > state.now : state.vm.deleted_at)
            return { rows: eligible ? [{ name: state.vm.name }] : [] }
        }
        if (sql.includes('SET deleted_at = NOW()')) Object.assign(state.vm, { deleted_at: new Date(state.now).toISOString(), delete_after: new Date(state.now + 30 * day).toISOString(), deletion_restore: JSON.parse(params[1]), deletion_error: params[2] ?? null })
        else if (sql.includes('SET deleted_at = NULL')) {
            if (state.failAt === 'restore-db') throw new Error('Database write failed')
            Object.assign(state.vm, { deleted_at: null, delete_after: null, deletion_restore: null, deletion_error: null })
        } else if (sql.startsWith('UPDATE vms SET deletion_error')) state.vm.deletion_error = params[1] ?? null
        else if (sql.startsWith('DELETE FROM vms')) state.vm = null
        else if (!sql.startsWith('DELETE FROM vm_shutdown')) throw new Error(`Unexpected SQL: ${sql}`)
        return { rows: state.vm ? [clone(state.vm)] : [] }
    },
}))
mock.module('../../src/utils/vms/lxd.ts', () => ({
    getLocalLxdInstance: async () => { if (!state.instance) throw new Error('Missing instance'); return clone(state.instance) },
    setLocalLxdInstanceState: async (_name: string, action: string) => {
        if (state.failAt === action) throw new Error(`Failed to ${action}`)
        if (action === 'start') state.starts++
        if (action === 'stop' && state.instance.ephemeral) throw new Error('Would destroy ephemeral disk')
        state.instance.status = action === 'start' ? 'Running' : 'Stopped'
    },
    lxdRequest: async (path: string, options: any = {}) => {
        if (path.includes('?recursion')) {
            if (state.failAt === 'host') throw new Error('Host unavailable')
            return { metadata: state.instance ? [{ name: state.instance.name }] : [] }
        }
        if (options.method === 'PATCH') {
            if (!state.operationId) {
                Object.assign(state.instance, options.body)
                return {}
            }
            state.pendingPatch = options.body
            return { operation: state.operationId }
        }
        if (options.method === 'DELETE') {
            if (state.failAt === 'purge') throw new Error('Disk delete failed')
            state.removed++; state.instance = null
            return {}
        }
        throw new Error(`Unexpected LXD request: ${path}`)
    },
    waitForLxdOperation: async (operation: string | undefined, timeout: number) => {
        state.waitCalls.push([operation, timeout])
        state.onWaitStarted?.()
        if (state.waitGate) await state.waitGate
        const result = clone(state.waitResult)
        if (result.metadata.status_code === 200 && state.pendingPatch) Object.assign(state.instance, state.pendingPatch)
        state.pendingPatch = null
        return result
    },
}))
mock.module('../../src/utils/vms/access.ts', () => ({ vmViewer: async (req: any, res: any) => {
    if (!req.headers.id) { res.status(401).send({ error: 'Unauthorized' }); return null }
    return { id: req.headers.id, admin: req.headers.id === 'admin' }
} }))
mock.module('../../src/utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
const { scheduleVmDeletion, restoreVm, maintainDeletedVms, deletionMarker } = await import('../../src/utils/vms/deletion.ts')
const { default: deleteVM, restoreVM } = await import('../../src/handlers/vms/delete.ts')
export const operations = { scheduleVmDeletion, restoreVm, maintainDeletedVms, deletionMarker }
export const app = Fastify()
app.delete('/vm/:id', deleteVM)
app.post('/vm/:id/restore', restoreVM)

beforeEach(() => {
    state.now = Date.parse('2026-09-12T12:00:00Z'); state.removed = 0; state.starts = 0; state.failAt = ''
    state.operationId = ''; state.waitResult = { metadata: { status_code: 200 } }; state.waitCalls = []; state.pendingPatch = null
    state.waitGate = undefined; state.onWaitStarted = undefined
    state.vm = { name: 'cashflow', primary_host: 'inspur', deleted_at: null, delete_after: null, deletion_restore: null, deletion_error: null }
    state.instance = { name: 'cashflow', status: 'Running', ephemeral: true, config: { 'boot.autostart': 'true', 'limits.cpu': '2' } }
})
