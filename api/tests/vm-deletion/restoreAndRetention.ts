import { expect, test } from 'bun:test'
import { app, day, operations, state } from './fixture.ts'

test('one restore request returns the VM to its previous state and cancels expiry', async () => {
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    state.now += 29 * day
    expect((await app.inject({ method: 'POST', url: '/vm/cashflow/restore', headers: { id: 'member' } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/vm/cashflow/restore', headers: { id: 'admin' } })).statusCode).toBe(200)
    expect(state.vm.deleted_at).toBeNull()
    expect(state.instance.status).toBe('Running')
    expect(state.instance.ephemeral).toBe(true)
    expect(state.instance.config['boot.autostart']).toBe('true')
    expect(state.instance.config['limits.cpu']).toBe('2')
    state.now += 10 * day
    await operations.maintainDeletedVms()
    expect(state.removed).toBe(0)
    expect(state.starts).toBe(1)
})

test('failed restore keeps the VM stopped and recoverable', async () => {
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    state.failAt = 'restore-db'
    await expect(operations.restoreVm('cashflow')).rejects.toThrow('Database write failed')
    expect(state.vm.deleted_at).not.toBeNull()
    expect(state.instance.status).toBe('Stopped')
    expect(state.instance.config[operations.deletionMarker]).toBe(state.vm.delete_after)
    expect(state.instance.ephemeral).toBe(false)
})

test('expiry boundary is enforced under the same lock as restore, and disk failures are retried', async () => {
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    state.now += 30 * day - 1
    await operations.maintainDeletedVms()
    expect(state.removed).toBe(0)
    state.now++
    state.failAt = 'purge'
    await expect(operations.restoreVm('cashflow')).rejects.toThrow('recovery period has ended')
    await expect(operations.maintainDeletedVms()).rejects.toThrow('Could not finish')
    expect(state.vm).not.toBeNull()
    state.failAt = 'host'
    await expect(operations.maintainDeletedVms()).rejects.toThrow('Could not finish')
    expect(state.vm).not.toBeNull()
    state.failAt = ''
    await operations.maintainDeletedVms()
    expect(state.removed).toBe(1)
    expect(state.vm).toBeNull()
})

test('restoring before expiry prevents a concurrent retention job from deleting the VM', async () => {
    await operations.scheduleVmDeletion('cashflow', 'cashflow')
    state.now += 29 * day
    await Promise.all([operations.restoreVm('cashflow'), operations.maintainDeletedVms()])
    expect(state.vm.deleted_at).toBeNull()
    expect(state.removed).toBe(0)
})
