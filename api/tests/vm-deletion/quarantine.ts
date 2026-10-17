import { expect, test } from 'bun:test'
import { app, day, operations, state } from './fixture.ts'

test('requires an administrator and the exact typed VM name before changing anything', async () => {
    for (const [id, confirmation, status] of [['', 'cashflow', 401], ['member', 'cashflow', 403], ['admin', 'Cashflow', 400], ['admin', 'cashflow ', 400], ['admin', '', 400]] as const) {
        expect((await app.inject({ method: 'DELETE', url: '/vm/cashflow', headers: { id }, payload: { confirmation } })).statusCode).toBe(status)
        expect(state.vm.deleted_at).toBeNull()
        expect(state.instance.status).toBe('Running')
    }
    expect((await app.inject({ method: 'DELETE', url: '/vm/cashflow', headers: { id: 'admin' }, payload: { confirmation: 'cashflow' } })).statusCode).toBe(200)
})

test('preserves the disk, disables startup, and retries without extending the 30-day deadline', async () => {
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    const deadline = state.vm.delete_after
    expect(Date.parse(deadline) - state.now).toBe(30 * day)
    expect(state.instance.status).toBe('Stopped')
    expect(state.instance.ephemeral).toBe(false)
    expect(state.instance.config[operations.deletionMarker]).toBe(deadline)
    expect(state.instance.config['boot.autostart']).toBe('false')
    state.now += 5 * day
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    await operations.maintainDeletedVms()
    expect(state.vm.delete_after).toBe(deadline)
    expect(state.removed).toBe(0)
})

test('waits for the LXD configuration operation before stopping the VM', async () => {
    state.operationId = 'quarantine-config'
    let completeWait!: () => void
    let signalWaitStarted!: () => void
    state.waitGate = new Promise(resolve => { completeWait = resolve })
    const waitStarted = new Promise<void>(resolve => { signalWaitStarted = resolve })
    state.onWaitStarted = signalWaitStarted

    const deletion = operations.scheduleVmDeletion('cashflow', 'cashflow')
    await waitStarted
    try {
        expect(state.waitCalls).toEqual([['quarantine-config', 90]])
        expect(state.instance.status).toBe('Running')
        expect(state.instance.config['boot.autostart']).toBe('true')
    } finally {
        completeWait()
    }
    await deletion
    expect(state.instance.status).toBe('Stopped')
    expect(state.instance.config['boot.autostart']).toBe('false')
    expect(state.vm.deletion_error).toBeNull()
})

test('a failed LXD configuration operation leaves the VM running and scheduled for retry', async () => {
    state.operationId = 'failed-quarantine-config'
    state.waitResult = { metadata: { status_code: 400, err: 'Configuration update failed.' } }
    await expect(operations.scheduleVmDeletion('cashflow', 'cashflow')).rejects.toThrow('Configuration update failed.')
    expect(state.waitCalls).toEqual([['failed-quarantine-config', 90]])
    expect(state.vm.deleted_at).not.toBeNull()
    expect(state.vm.deletion_error).toBe('Configuration update failed.')
    expect(state.instance.status).toBe('Running')
    expect(state.instance.ephemeral).toBe(true)
    expect(state.instance.config['boot.autostart']).toBe('true')
})

test('failed stop keeps recovery information and the original deadline for retry', async () => {
    state.failAt = 'stop'
    await expect(operations.scheduleVmDeletion('cashflow', 'cashflow')).rejects.toThrow('Failed to stop')
    expect(state.vm.deletion_restore).not.toBeNull()
    expect(state.vm.deletion_error).toBe('Failed to stop')
    const deadline = state.vm.delete_after
    state.failAt = ''; state.now += day
    await operations.maintainDeletedVms()
    expect(state.instance.status).toBe('Stopped')
    expect(state.vm.delete_after).toBe(deadline)
    expect(state.vm.deletion_error).toBeNull()
})
