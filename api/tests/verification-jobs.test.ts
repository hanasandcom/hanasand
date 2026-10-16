import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

type Job = Record<string, any>
const jobs = new Map<string, Job>()
const calls: Array<{ sql: string, params: unknown[] }> = []
const usageEvents: Array<Record<string, any>> = []
const fetchCalls: Array<{ url: string, signal?: AbortSignal, userAgent?: string }> = []
const terminalAttempts: string[] = []
let nextFetchError: Error | null = null
let nextFetchStatus = 200
let cancelOnWorkerRead = false
let holdFetch = false
let onFetchStarted: (() => void) | null = null
let releaseFetch: ((response: Response) => void) | null = null
let rejectFetch: ((error: Error) => void) | null = null
const workerStatusReads: string[] = []

const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    if (sql.includes('INSERT INTO ai_verification_jobs')) {
        const [id, ownerId, workspaceKind, workspaceId, kind, priority, lane, maxRetries, targetUrl, deployUrl, requestId, metadata] = params
        jobs.set(String(id), {
            id, owner_id: ownerId, workspace_kind: workspaceKind, workspace_id: workspaceId, kind,
            status: 'queued', priority, lane, queue_position: 0, retry_count: 0, max_retries: maxRetries,
            current_step: 'Queued', target_url: targetUrl, deploy_url: deployUrl, request_id: requestId,
            artifacts: [], metadata: JSON.parse(String(metadata)), error: null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            started_at: null, completed_at: null, cancelled_at: null,
        })
        return { rows: [] }
    }
    if (sql.includes('WITH ranked AS')) return { rows: [] }
    if (sql.includes('SET queue_position = 0 WHERE status <> \'queued\'')) return { rows: [] }
    if (sql.includes('SET status = \'cancelled\'')) {
        const job = jobs.get(String(params[0]))
        if (!job || job.owner_id !== params[1] || !['queued', 'running'].includes(job.status)) return { rows: [] }
        const now = new Date().toISOString()
        Object.assign(job, { status: 'cancelled', current_step: 'Cancelled', cancelled_at: now, completed_at: job.completed_at || now })
        return { rows: [job] }
    }
    if (sql.includes('UPDATE ai_verification_jobs') && sql.includes('SET status = \'running\'')) {
        const job = [...jobs.values()].find((item) => item.status === 'queued')
        if (!job) return { rows: [] }
        Object.assign(job, { status: 'running', current_step: 'Starting', started_at: new Date().toISOString() })
        return { rows: [job] }
    }
    if (sql.includes('SELECT * FROM ai_verification_jobs WHERE id = $1 AND owner_id = $2')) {
        return { rows: [jobs.get(String(params[0]))].filter(Boolean) }
    }
    if (sql.includes('COUNT(*) FILTER')) {
        const values = [...jobs.values()]
        return { rows: [{
            queued: values.filter(job => job.status === 'queued').length,
            running: values.filter(job => job.status === 'running').length,
            failed: values.filter(job => job.status === 'failed').length,
            completed: values.filter(job => job.status === 'completed').length,
        }] }
    }
    if (sql.includes('SELECT * FROM ai_verification_jobs WHERE id = $1')) {
        const job = jobs.get(String(params[0]))
        workerStatusReads.push(String(params[0]))
        if (cancelOnWorkerRead && job?.status === 'running') job.status = 'cancelled'
        return { rows: [job].filter(Boolean) }
    }
    if (sql.includes('SET current_step = $2')) {
        const job = jobs.get(String(params[0]))
        if (job?.status === 'running') job.current_step = params[1]
        return { rows: [] }
    }
    if (sql.includes('SET status = $2')) {
        const job = jobs.get(String(params[0]))
        terminalAttempts.push(String(params[0]))
        if (job?.status === 'running' && sql.includes('AND status = \'running\'')) Object.assign(job, {
            status: params[1], current_step: params[2],
            artifacts: [...job.artifacts, ...JSON.parse(String(params[3]))], error: params[4],
            completed_at: new Date().toISOString(),
        })
        return { rows: job?.status === params[1] ? [{ id: job.id }] : [] }
    }
    if (sql.includes('SET status = \'completed\'')) {
        const job = jobs.get(String(params[0]))
        if (job?.status !== 'running' || !sql.includes('AND status = \'running\'')) return { rows: [] }
        Object.assign(job, { status: 'completed', current_step: 'Receipt stored', artifacts: [...job.artifacts, ...JSON.parse(String(params[1]))], completed_at: new Date().toISOString() })
        return { rows: [{ id: job.id }] }
    }
    if (sql.includes('SET status = \'failed\'')) {
        const job = jobs.get(String(params[0]))
        if (job?.status === 'running' && sql.includes('AND status = \'running\'')) Object.assign(job, { status: 'failed', current_step: 'Failed', error: params[1] })
        return { rows: [] }
    }
    if (sql.includes('SET status = \'queued\'')) {
        const job = jobs.get(String(params[0]))
        if (job?.status === 'running' && sql.includes('AND status = \'running\'')) Object.assign(job, { status: 'queued', retry_count: job.retry_count + 1, current_step: 'Retry queued', error: params[1] })
        return { rows: job?.status === 'queued' ? [{ id: job.id }] : [] }
    }
    throw new Error(`Unexpected SQL: ${sql}`)
}

mock.module('#db', () => ({ default: query }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner' }) }))
mock.module('../src/utils/ai/usage.ts', () => ({ recordAiUsageEvent: async (event: Record<string, any>) => { usageEvents.push(event) } }))
mock.module('node:child_process', () => ({
    spawn: () => {
        const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), kill: () => true })
        queueMicrotask(() => child.emit('error', new Error('Chromium is unavailable.')))
        return child
    },
}))

const { cancelVerificationJob, postVerificationJob } = await import('../src/handlers/tools/verificationJobs.ts')
const actualFetch = globalThis.fetch
const page = '<title>Studio</title><meta name="viewport"><h1>Studio</h1><h2>Booking</h2><style>:root { --brand: navy } @media (max-width: 700px) { .layout { flex-wrap: wrap } }</style><img src="/studio.jpg"><p>A studio for booking and client projects. Our team handles each location and service with care.</p>'

beforeEach(() => {
    jobs.clear()
    calls.length = 0
    usageEvents.length = 0
    fetchCalls.length = 0
    terminalAttempts.length = 0
    workerStatusReads.length = 0
    nextFetchError = null
    nextFetchStatus = 200
    cancelOnWorkerRead = false
    holdFetch = false
    onFetchStarted = null
    releaseFetch = null
    rejectFetch = null
    globalThis.fetch = mock(async (input, init) => {
        fetchCalls.push({
            url: String(input),
            signal: init?.signal as AbortSignal | undefined,
            userAgent: new Headers(init?.headers).get('User-Agent') || undefined,
        })
        if (nextFetchError) throw nextFetchError
        if (holdFetch) {
            onFetchStarted?.()
            return await new Promise<Response>((resolve, reject) => {
                releaseFetch = resolve
                rejectFetch = reject
            })
        }
        return new Response(page, {
            status: nextFetchStatus,
            statusText: nextFetchStatus === 503 ? 'Service Unavailable' : '',
        })
    }) as typeof fetch
})

afterEach(() => { globalThis.fetch = actualFetch })

function reply() {
    return {
        statusCode: 200,
        body: null as any,
        status(code: number) { this.statusCode = code; return this },
        send(body: any) { this.body = body; return body },
    }
}

async function enqueue(kind: 'browser' | 'design', maxRetries = 1) {
    const response = reply()
    await postVerificationJob({
        headers: { 'x-request-id': `${kind}-request` },
        body: { kind, targetUrl: 'https://example.test/proof', maxRetries },
    } as any, response as any)
    expect(response.statusCode).toBe(202)
    return String(response.body.job.id)
}

async function waitForJob(id: string) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const job = jobs.get(id)
        if (job?.status === 'completed' || job?.status === 'failed') return job
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Verification job ${id} did not finish.`)
}

async function waitForStatus(id: string, status: string) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        if (jobs.get(id)?.status === status) return
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Verification job ${id} did not reach ${status}.`)
}

test('browser and design jobs retain their distinct fetch steps, headers, and proof output', async () => {
    const browserId = await enqueue('browser')
    const browser = await waitForJob(browserId)
    const designId = await enqueue('design')
    const design = await waitForJob(designId)

    expect(browser).toMatchObject({ status: 'completed', current_step: 'Browser proof completed' })
    expect(browser.artifacts[0]).toMatchObject({ type: 'browser_result', data: { status: 200, title: 'Studio' } })
    expect(design).toMatchObject({ status: 'completed', current_step: 'Design QA passed' })
    expect(design.artifacts[0]).toMatchObject({ type: 'design_quality_report', data: { status: 'passed', title: 'Studio' } })
    expect(fetchCalls.map(call => [call.url, call.userAgent])).toEqual([
        ['https://example.test/proof', 'HanasandAI-VerificationJob/1.0'],
        ['https://example.test/proof', 'HanasandAI-DesignQualityJob/1.0'],
    ])
    expect(fetchCalls.every(call => call.signal instanceof AbortSignal)).toBe(true)
    expect(calls.filter(call => call.sql.includes('SET current_step = $2')).map(call => call.params[1])).toEqual([
        'Fetching browser target', 'Extracting evidence', 'Fetching design target', 'Scoring design quality',
    ])
    expect(usageEvents.map(event => event.metadata.jobId)).toEqual([browserId, designId])
})

test('non-success HTTP responses store failed proof and zero-billable usage', async () => {
    nextFetchStatus = 503
    const browserId = await enqueue('browser', 0)
    const browser = await waitForJob(browserId)
    const designId = await enqueue('design', 0)
    const design = await waitForJob(designId)

    expect(browser).toMatchObject({ status: 'failed', current_step: 'Browser proof failed', error: 'HTTP 503 Service Unavailable' })
    expect(browser.artifacts[0]).toMatchObject({ type: 'browser_result', data: { ok: false, status: 503 } })
    expect(design).toMatchObject({ status: 'failed', current_step: 'Design QA failed' })
    expect(design.error).toStartWith('Design QA score ')
    expect(design.artifacts[0]).toMatchObject({ type: 'design_quality_report', data: { ok: false, passed: false, status: 'failed' } })
    expect(usageEvents).toMatchObject([
        { billableUnits: 0, estimatedCostNok: 0, outcome: 'failed', metadata: { jobId: browserId } },
        { billableUnits: 0, estimatedCostNok: 0, outcome: 'failed', metadata: { jobId: designId, proofType: 'design_quality' } },
    ])
})

test('target request failures clear the timeout and retain the job failure path', async () => {
    nextFetchError = new Error('Target unavailable.')
    const id = await enqueue('browser', 0)
    const job = await waitForJob(id)
    await new Promise(resolve => setTimeout(resolve, 1050))

    expect(job).toMatchObject({ status: 'failed', current_step: 'Failed', error: 'Target unavailable.' })
    expect(fetchCalls[0]?.signal?.aborted).toBe(false)
    expect(usageEvents).toEqual([])
})

test('jobs cancelled before target fetch do not make the request', async () => {
    cancelOnWorkerRead = true
    const id = await enqueue('browser')
    await waitForStatus(id, 'cancelled')

    expect(fetchCalls).toEqual([])
    expect(usageEvents).toEqual([])
})

test('cancelling a job during its held fetch keeps the cancellation and skips usage', async () => {
    holdFetch = true
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>(resolve => { markFetchStarted = resolve })
    onFetchStarted = markFetchStarted

    const id = await enqueue('browser')
    await fetchStarted
    expect(jobs.get(id)?.status).toBe('running')

    const response = reply()
    await cancelVerificationJob({ headers: {}, params: { id } } as any, response as any)
    expect(response.statusCode).toBe(200)
    expect(response.body.job.status).toBe('cancelled')
    expect(fetchCalls[0]?.signal?.aborted).toBe(true)

    releaseFetch?.(new Response(page, { status: 200 }))
    for (let attempt = 0; attempt < 200 && !terminalAttempts.includes(id); attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect(terminalAttempts).toContain(id)
    expect(jobs.get(id)).toMatchObject({ status: 'cancelled', current_step: 'Cancelled', artifacts: [] })
    expect(jobs.get(id)?.completed_at).toBe(jobs.get(id)?.cancelled_at)
    expect(usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})

test('a held fetch rejection after cancellation does not retry or fail the job', async () => {
    holdFetch = true
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>(resolve => { markFetchStarted = resolve })
    onFetchStarted = markFetchStarted

    const id = await enqueue('browser')
    await fetchStarted

    const response = reply()
    await cancelVerificationJob({ headers: {}, params: { id } } as any, response as any)
    expect(response.body.job.status).toBe('cancelled')
    expect(fetchCalls[0]?.signal?.aborted).toBe(true)

    rejectFetch?.(new Error('Fetch aborted.'))
    for (let attempt = 0; attempt < 200 && workerStatusReads.filter(readId => readId === id).length < 2; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5))
    }

    expect(workerStatusReads.filter(readId => readId === id)).toHaveLength(2)
    expect(jobs.get(id)).toMatchObject({ status: 'cancelled', retry_count: 0, artifacts: [] })
    expect(calls.some(call => call.sql.includes('SET status = \'queued\'') || call.sql.includes('SET status = \'failed\''))).toBe(false)
    expect(usageEvents.filter(event => event.metadata.jobId === id)).toEqual([])
})
