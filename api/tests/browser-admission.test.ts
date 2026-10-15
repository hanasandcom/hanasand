import { afterEach, expect, test } from 'bun:test'
import { currentBrowserAdmissionStatus, requestBrowserAdmission, trackBrowserAdmissionRelease } from '../src/utils/ws/browserAdmission.ts'

const originalMaxSessions = process.env.BROWSER_SANDBOX_MAX_SESSIONS

afterEach(() => {
    if (originalMaxSessions === undefined) delete process.env.BROWSER_SANDBOX_MAX_SESSIONS
    else process.env.BROWSER_SANDBOX_MAX_SESSIONS = originalMaxSessions
})

test('browser admission preserves FIFO status, queued cancellation, and idempotent release', async () => {
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    const firstMessages: Record<string, unknown>[] = []
    const secondMessages: Record<string, unknown>[] = []
    const thirdMessages: Record<string, unknown>[] = []
    const first = requestBrowserAdmission('first', payload => firstMessages.push(payload))
    const second = requestBrowserAdmission('second', payload => secondMessages.push(payload))
    const third = requestBrowserAdmission('third', payload => thirdMessages.push(payload))
    let firstSlot: Awaited<typeof first.promise> | undefined
    let thirdSlot: Awaited<typeof third.promise> | undefined

    try {
        firstSlot = await first.promise
        expect(firstSlot.status).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        expect(secondMessages[0]).toMatchObject({ type: 'status', state: 'capacity_busy', sessionId: 'second', capacity: { queuePosition: 1 } })
        expect(thirdMessages[0]).toMatchObject({ type: 'status', state: 'capacity_busy', sessionId: 'third', capacity: { queuePosition: 2 } })
        expect(secondMessages.at(-1)).toMatchObject({ state: 'capacity_queue_position', capacity: { queuePosition: 1 } })
        expect(thirdMessages.at(-1)).toMatchObject({ state: 'capacity_queue_position', capacity: { queuePosition: 2 } })

        second.cancel()
        expect(thirdMessages.at(-1)).toMatchObject({ state: 'capacity_queue_position', capacity: { queuePosition: 1 } })
        const admitted = third.promise
        firstSlot.release()
        thirdSlot = await admitted

        expect(thirdMessages.some(message => message.state === 'capacity_admitted')).toBe(true)
        expect(thirdSlot.status).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        firstSlot.release()
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 1, queuedSessions: 0, maxSessions: 1 })
        thirdSlot.release()
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 0, queuedSessions: 0, maxSessions: 1 })
    } finally {
        second.cancel()
        third.cancel()
        firstSlot?.release()
        thirdSlot?.release()
    }
})

test('browser admission serves existing waiters first when the session cap increases', async () => {
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    const first = requestBrowserAdmission('first', () => undefined)
    const second = requestBrowserAdmission('second', () => undefined)
    const thirdMessages: Record<string, unknown>[] = []
    const third = requestBrowserAdmission('third', payload => thirdMessages.push(payload))
    const fourthMessages: Record<string, unknown>[] = []
    let firstSlot: Awaited<typeof first.promise> | undefined
    let secondSlot: Awaited<typeof second.promise> | undefined
    let thirdSlot: Awaited<typeof third.promise> | undefined
    let fourthSlot: Awaited<typeof fourth.promise> | undefined
    let cancelFourth = () => undefined

    try {
        firstSlot = await first.promise
        process.env.BROWSER_SANDBOX_MAX_SESSIONS = '2'
        const fourth = requestBrowserAdmission('fourth', payload => fourthMessages.push(payload))
        cancelFourth = fourth.cancel
        secondSlot = await second.promise
        expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 2, queuedSessions: 2, maxSessions: 2 })
        expect(fourthMessages[0]).toMatchObject({ state: 'capacity_busy', capacity: { queuePosition: 2 } })
        expect(thirdMessages.at(-1)).toMatchObject({ state: 'capacity_queue_position', capacity: { queuePosition: 1 } })

        firstSlot.release()
        thirdSlot = await third.promise
        secondSlot.release()
        fourthSlot = await fourth.promise
        expect(fourthMessages.some(message => message.state === 'capacity_admitted')).toBe(true)
    } finally {
        firstSlot?.release()
        secondSlot?.release()
        thirdSlot?.release()
        fourthSlot?.release()
        cancelFourth()
        third.cancel()
    }
})

test('an admission granted before a socket closes is released by its close owner', async () => {
    process.env.BROWSER_SANDBOX_MAX_SESSIONS = '1'
    let closed = false
    const admission = requestBrowserAdmission('closed-before-start', () => undefined)
    const lease = trackBrowserAdmissionRelease(admission.promise, () => closed)
    const slot = await admission.promise

    closed = true
    lease.release()

    expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 0, queuedSessions: 0, maxSessions: 1 })
    // The consumer may also observe the resolved slot later; release remains safe.
    slot.release()
    expect(currentBrowserAdmissionStatus()).toMatchObject({ activeSessions: 0, queuedSessions: 0, maxSessions: 1 })
})
