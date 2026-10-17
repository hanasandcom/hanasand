import { test } from 'bun:test'
import './verification-jobs-cancellation.ts'
import { enqueue, expect, postVerificationJob, reply, state, waitForJob } from './verification-jobs-fixture.ts'

test('invalid retry and timeout inputs use their bounded defaults', async () => {
    const response = reply()
    await postVerificationJob({
        headers: {},
        body: {
            kind: 'browser',
            targetUrl: 'https://example.test/proof',
            maxRetries: 'many',
            timeoutMs: 'soon',
        },
    } as any, response as any)

    const insert = state.calls.find(call => call.sql.includes('INSERT INTO ai_verification_jobs'))
    expect(response.statusCode).toBe(202)
    expect(insert?.params[7]).toBe(1)
    expect(JSON.parse(String(insert?.params[11]))).toMatchObject({ timeoutMs: 16000 })
})


test('verification targets reject embedded credentials before enqueueing', async () => {
    const response = reply()
    await postVerificationJob({ headers: {}, body: { kind: 'browser', targetUrl: 'https://user:pass@example.test/proof' } } as any, response as any)

    expect(response.statusCode).toBe(400)
    expect(response.body.error).toBe('Verification targets cannot include embedded credentials.')
    expect(state.calls.some(call => call.sql.includes('INSERT INTO ai_verification_jobs'))).toBe(false)
})


test('browser and design jobs retain their distinct fetch steps, headers, and proof output', async () => {
    const browserId = await enqueue('browser')
    const browser = await waitForJob(browserId)
    const designId = await enqueue('design')
    const design = await waitForJob(designId)

    expect(browser).toMatchObject({ status: 'completed', current_step: 'Browser proof completed' })
    expect(browser.artifacts[0]).toMatchObject({ type: 'browser_result', data: { status: 200, title: 'Studio' } })
    expect(browser.artifacts[0]).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), name: 'Browser evidence', createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    expect(design).toMatchObject({ status: 'completed', current_step: 'Design QA passed' })
    expect(design.artifacts[0]).toMatchObject({ type: 'design_quality_report', data: { status: 'passed', title: 'Studio' } })
    expect(design.artifacts[0]).toMatchObject({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i), name: 'Design quality report', createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    expect(state.fetchCalls.map(call => [call.url, call.userAgent])).toEqual([
        ['https://example.test/proof', 'HanasandAI-VerificationJob/1.0'],
        ['https://example.test/proof', 'HanasandAI-DesignQualityJob/1.0'],
    ])
    expect(state.fetchCalls.every(call => call.signal instanceof AbortSignal)).toBe(true)
    expect(state.fetchCalls.every(call => call.followRedirects && call.readBody && call.accept?.startsWith('text/html'))).toBe(true)
    expect(state.fetchCalls.every(call => call.timeoutMs === 16000)).toBe(true)
    expect(state.calls.filter(call => call.sql.includes('SET current_step = $2')).map(call => call.params[1])).toEqual([
        'Fetching browser target', 'Extracting evidence', 'Fetching design target', 'Scoring design quality',
    ])
    expect(state.usageEvents.map(event => event.metadata.jobId)).toEqual([browserId, designId])
})


test('build receipts use the shared terminal transition and retain build usage accounting', async () => {
    const response = reply()
    await postVerificationJob({
        headers: { 'x-request-id': 'build-request' },
        body: { kind: 'build', deployUrl: 'https://example.test/deploy' },
    } as any, response as any)
    const id = String(response.body.job.id)
    const job = await waitForJob(id)

    expect(job).toMatchObject({ status: 'completed', current_step: 'Receipt stored' })
    expect(job.artifacts[0]).toMatchObject({
        type: 'build_receipt',
        data: { deployUrl: 'https://example.test/deploy', requestId: 'build-request' },
    })
    expect(state.usageEvents).toMatchObject([{
        kind: 'build_minutes_recorded',
        billableUnits: 1,
        outcome: 'verified',
        metadata: { jobId: id, requestId: 'build-request', currentStep: 'Receipt stored' },
    }])
})


test('a lost running-state guard skips artifact persistence side effects', async () => {
    state.loseTerminalTransition = true
    const response = reply()
    await postVerificationJob({
        headers: { 'x-request-id': 'build-request' },
        body: { kind: 'build' },
    } as any, response as any)
    const id = String(response.body.job.id)

    for (let attempt = 0; attempt < 200 && !state.terminalAttempts.includes(id); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect(state.terminalAttempts).toContain(id)
    expect(state.jobs.get(id)).toMatchObject({ status: 'cancelled', current_step: 'Cancelled', artifacts: [] })
    expect(state.usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})


test('successful build receipts retain an earlier attempt error', async () => {
    state.existingErrorOnClaim = 'Earlier build attempt failed.'
    const response = reply()
    await postVerificationJob({ headers: {}, body: { kind: 'build' } } as any, response as any)
    const id = String(response.body.job.id)
    const job = await waitForJob(id)

    expect(job).toMatchObject({ status: 'completed', error: 'Earlier build attempt failed.' })
})


test('non-success HTTP responses store failed proof and zero-billable usage', async () => {
    state.nextFetchStatus = 503
    const browserId = await enqueue('browser', 0)
    const browser = await waitForJob(browserId)
    const designId = await enqueue('design', 0)
    const design = await waitForJob(designId)

    expect(browser).toMatchObject({ status: 'failed', current_step: 'Browser proof failed', error: 'HTTP 503 Service Unavailable' })
    expect(browser.artifacts[0]).toMatchObject({ type: 'browser_result', data: { ok: false, status: 503 } })
    expect(design).toMatchObject({ status: 'failed', current_step: 'Design QA failed' })
    expect(design.error).toStartWith('Design QA score ')
    expect(design.artifacts[0]).toMatchObject({ type: 'design_quality_report', data: { ok: false, passed: false, status: 'failed' } })
    expect(state.usageEvents).toMatchObject([
        { billableUnits: 0, estimatedCostNok: 0, outcome: 'failed', metadata: { jobId: browserId } },
        { billableUnits: 0, estimatedCostNok: 0, outcome: 'failed', metadata: { jobId: designId, proofType: 'design_quality' } },
    ])
})


test('target request failures retain the job failure path', async () => {
    state.nextFetchError = new Error('Target unavailable.')
    const id = await enqueue('browser', 0)
    const job = await waitForJob(id)
    expect(job).toMatchObject({ status: 'failed', current_step: 'Failed', error: 'Target unavailable.' })
    expect(state.fetchCalls[0]?.timeoutMs).toBe(16000)
    expect(state.usageEvents).toEqual([])
})


test('retries a failed target request only within its configured retry count', async () => {
    state.nextFetchError = new Error('Target unavailable.')
    const id = await enqueue('browser', 1)
    const job = await waitForJob(id)

    expect(job).toMatchObject({ status: 'failed', retry_count: 1, error: 'Target unavailable.' })
    expect(state.fetchCalls.filter(call => call.url === 'https://example.test/proof')).toHaveLength(2)
    expect(state.usageEvents).toEqual([])
})


test('Chromium debug startup failures kill the spawned process', async () => {
    const id = await enqueue('browser', 0)
    const job = await waitForJob(id)

    expect(job.status).toBe('completed')
    expect(state.chromiumKillSignals).toEqual(['SIGKILL'])
})


test('production verification never spawns an in-process Chromium renderer', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
        const id = await enqueue('browser', 0, { captureScreenshot: true })
        const job = await waitForJob(id)

        expect(job.status).toBe('completed')
        expect(job.artifacts[0].data.screenshots).toEqual([])
        expect(job.artifacts[0].data.journeyProof).toBeNull()
        expect(state.chromiumSpawnCount).toBe(0)
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = previousNodeEnv
    }
})
