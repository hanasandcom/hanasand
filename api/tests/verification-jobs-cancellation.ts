import { test } from 'bun:test'
import { cancelVerificationJob, enqueue, expect, page, reply, state, waitForStatus } from './verification-jobs-fixture.ts'

test('cancelling while a screenshot runs kills Chromium and skips later render steps', async () => {
    state.failChromiumStartup = false
    let markChromiumStarted!: () => void
    const chromiumStarted = new Promise<void>(resolve => { markChromiumStarted = resolve })
    state.onChromiumSpawn = markChromiumStarted

    const id = await enqueue('browser', 0, { captureScreenshot: true })
    await chromiumStarted
    expect(state.chromiumSpawnCount).toBe(1)

    const response = reply()
    await cancelVerificationJob({ headers: {}, params: { id } } as any, response as any)
    for (let attempt = 0; attempt < 200 && state.workerStatusReads.length < 2; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect(response.body.job.status).toBe('cancelled')
    expect(state.chromiumKillSignals).toEqual(['SIGKILL'])
    expect(state.chromiumSpawnCount).toBe(1)
    expect(state.jobs.get(id)).toMatchObject({ status: 'cancelled', artifacts: [] })
    expect(state.usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})


test('jobs cancelled before target fetch do not make the request', async () => {
    state.cancelOnWorkerRead = true
    const id = await enqueue('browser')
    await waitForStatus(id, 'cancelled')

    expect(state.fetchCalls).toEqual([])
    expect(state.usageEvents).toEqual([])
})


test('cancelling a job during its held fetch keeps the cancellation without terminal writes or usage', async () => {
    state.holdFetch = true
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>(resolve => { markFetchStarted = resolve })
    state.onFetchStarted = markFetchStarted

    const id = await enqueue('browser')
    await fetchStarted
    expect(state.jobs.get(id)?.status).toBe('running')

    const response = reply()
    await cancelVerificationJob({ headers: {}, params: { id } } as any, response as any)
    expect(response.statusCode).toBe(200)
    expect(response.body.job.status).toBe('cancelled')
    expect(state.fetchCalls[0]?.signal?.aborted).toBe(true)

    state.releaseFetch?.({ status: 200, statusText: '', ok: true, url: 'https://example.test/proof', body: page })
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(state.terminalAttempts).not.toContain(id)
    expect(state.jobs.get(id)).toMatchObject({ status: 'cancelled', current_step: 'Cancelled', artifacts: [] })
    expect(state.jobs.get(id)?.completed_at).toBe(state.jobs.get(id)?.cancelled_at)
    expect(state.usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})


test('a held fetch rejection after cancellation does not retry or fail the job', async () => {
    state.holdFetch = true
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>(resolve => { markFetchStarted = resolve })
    state.onFetchStarted = markFetchStarted

    const id = await enqueue('browser')
    await fetchStarted

    const response = reply()
    await cancelVerificationJob({ headers: {}, params: { id } } as any, response as any)
    expect(response.body.job.status).toBe('cancelled')
    expect(state.fetchCalls[0]?.signal?.aborted).toBe(true)

    state.rejectFetch?.(new Error('Fetch aborted.'))
    for (let attempt = 0; attempt < 200 && state.workerStatusReads.filter(readId => readId === id).length < 2; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect(state.workerStatusReads.filter(readId => readId === id)).toHaveLength(2)
    expect(state.jobs.get(id)).toMatchObject({ status: 'cancelled', retry_count: 0, artifacts: [] })
    expect(state.calls.some(call => call.sql.includes('SET status = \'queued\'') || call.sql.includes('SET status = \'failed\''))).toBe(false)
    expect(state.usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})
