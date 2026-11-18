import { expect, test } from 'bun:test'
import { vmCs2ProvisionTimeoutMs, vmProvisionTimeoutForOptions, vmProvisionTimeoutMs, waitForVmProvisionOnHost } from '../src/utils/vms/provisionOnHost.ts'

test('host provisioning watcher allows supported setup downloads and installs to finish', () => {
    expect(vmProvisionTimeoutMs).toBe(60 * 60_000)
    expect(vmProvisionTimeoutMs).toBeGreaterThan(150_000)
    expect(vmCs2ProvisionTimeoutMs).toBe(435 * 60_000)
    expect(vmProvisionTimeoutForOptions({ services: ['game-cs2'] })).toBe(vmCs2ProvisionTimeoutMs)
    expect(vmProvisionTimeoutForOptions({ services: ['game-terraria'] })).toBe(vmProvisionTimeoutMs)
    expect(vmProvisionTimeoutForOptions()).toBe(vmProvisionTimeoutMs)
})

test('host provisioning watcher keeps polling until the VM reports Running', async () => {
    let calls = 0
    await waitForVmProvisionOnHost('inspur', 'setup-vm', async () => {
        calls += 1
        return new Response(JSON.stringify({ status: calls < 3 ? 'Provisioning' : 'Running' }))
    }, { timeoutMs: 1_000, pollIntervalMs: 1 })
    expect(calls).toBe(3)
})

test('host provisioning watcher stops only after its configured deadline', async () => {
    let calls = 0
    await expect(waitForVmProvisionOnHost('inspur', 'slow-vm', async () => {
        calls += 1
        return new Response(JSON.stringify({ status: 'Provisioning' }))
    }, { timeoutMs: 20, pollIntervalMs: 1 })).rejects.toThrow('within 0.02 seconds')
    expect(calls).toBeGreaterThan(1)
})
