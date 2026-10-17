// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createQueuedRefresh } from '../src/components/dashboard/queuedRefresh'

test('coalesces refresh events into one follow-up request', async () => {
    let calls = 0
    let releaseFirst!: () => void
    let startFirst!: () => void
    let finishSecond!: () => void
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
    const firstStarted = new Promise<void>(resolve => { startFirst = resolve })
    const secondFinished = new Promise<void>(resolve => { finishSecond = resolve })
    const refresh = createQueuedRefresh(async () => {
        calls += 1
        if (calls === 1) { startFirst(); await firstGate }
        else finishSecond()
    }, () => false)

    const firstRequest = refresh()
    await firstStarted
    await refresh()
    await refresh()
    expect(calls).toBe(1)

    releaseFirst()
    await firstRequest
    await secondFinished
    expect(calls).toBe(2)
})

test('does not start a queued refresh after its effect is aborted', async () => {
    let calls = 0
    let aborted = false
    let releaseFirst!: () => void
    let startFirst!: () => void
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
    const firstStarted = new Promise<void>(resolve => { startFirst = resolve })
    const refresh = createQueuedRefresh(async () => {
        calls += 1
        startFirst()
        await firstGate
    }, () => aborted)

    const firstRequest = refresh()
    await firstStarted
    await refresh()
    aborted = true
    releaseFirst()
    await firstRequest

    expect(calls).toBe(1)
})
