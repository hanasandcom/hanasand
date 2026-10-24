import { mock, expect, test } from 'bun:test'

let now = 0
mock.module('node:timers/promises', () => ({
    setTimeout: async (milliseconds: number) => {
        now += milliseconds
    },
}))

const { waitForVmProvisionOnHost } = await import('../src/utils/vms/provisionOnHost.ts')

test.serial('host provisioning keeps polling beyond the old 150-second cutoff', async () => {
    const originalNow = Date.now
    let requests = 0
    now = 0
    Date.now = () => now
    try {
        await waitForVmProvisionOnHost('host', 'builder-vm', async () => {
            requests++
            if (requests <= 78) return new Response('', { status: 503 })
            return new Response(JSON.stringify({ status: 'running' }), { status: 200 })
        })
        expect(now).toBeGreaterThan(150_000)
        expect(requests).toBe(79)
    } finally {
        Date.now = originalNow
    }
})
