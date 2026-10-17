import { EventEmitter } from 'node:events'
import { beforeEach, expect, mock } from 'bun:test'
import { query } from './verification-jobs-database.ts'
import { resetVerificationJobState, state } from './verification-jobs-state.ts'

export { expect, state }

mock.module('#db', () => ({ default: query }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner' }) }))
mock.module('../src/utils/ai/usage.ts', () => ({ recordAiUsageEvent: async (event: Record<string, any>) => { state.usageEvents.push(event) } }))

export const page = '<title>Studio</title><meta name="viewport"><h1>Studio</h1><h2>Booking</h2><style>:root { --brand: navy } @media (max-width: 700px) { .layout { flex-wrap: wrap } }</style><img src="/studio.jpg"><p>A studio for booking and client projects. Our team handles each location and service with care.</p>'

mock.module('#utils/publicMonitoringRequest.ts', () => ({
    publicMonitoringRequest: async (input: string | URL, options: {
        headers?: Record<string, string>
        userAgent?: string
        followRedirects: boolean
        readBody?: boolean
        timeoutMs: number
        signal?: AbortSignal
    }) => {
        state.fetchCalls.push({
            url: String(input), signal: options.signal, userAgent: options.userAgent,
            accept: options.headers?.Accept, followRedirects: options.followRedirects,
            readBody: options.readBody, timeoutMs: options.timeoutMs,
        })
        if (state.nextFetchError) throw state.nextFetchError
        if (state.holdFetch) {
            state.onFetchStarted?.()
            return await new Promise((resolve, reject) => {
                state.releaseFetch = resolve
                state.rejectFetch = reject
            })
        }
        return {
            status: state.nextFetchStatus,
            statusText: state.nextFetchStatus === 503 ? 'Service Unavailable' : '',
            ok: state.nextFetchStatus >= 200 && state.nextFetchStatus < 300,
            url: String(input), body: page,
        }
    },
}))

mock.module('node:child_process', () => ({
    spawn: () => {
        state.chromiumSpawnCount += 1
        const child = Object.assign(new EventEmitter(), {
            stderr: new EventEmitter(),
            kill: (signal: string) => {
                state.chromiumKillSignals.push(signal)
                queueMicrotask(() => child.emit('close', null))
                return true
            },
        })
        state.onChromiumSpawn?.()
        if (state.failChromiumStartup) queueMicrotask(() => child.emit('error', new Error('Chromium is unavailable.')))
        return child
    },
}))

export const { cancelVerificationJob, postVerificationJob } = await import('../src/handlers/tools/verificationJobs.ts')

beforeEach(resetVerificationJobState)

export function reply() {
    return {
        statusCode: 200,
        body: null as any,
        status(code: number) { this.statusCode = code; return this },
        send(body: any) { this.body = body; return body },
    }
}

export async function enqueue(kind: 'browser' | 'build' | 'design', maxRetries = 1, extra: Record<string, unknown> = {}) {
    const response = reply()
    await postVerificationJob({
        headers: { 'x-request-id': `${kind}-request` },
        body: { kind, targetUrl: 'https://example.test/proof', maxRetries, ...extra },
    } as any, response as any)
    expect(response.statusCode).toBe(202)
    return String(response.body.job.id)
}

export async function waitForJob(id: string) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const job = state.jobs.get(id)
        if (job?.status === 'completed' || job?.status === 'failed') return job
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Verification job ${id} did not finish.`)
}

export async function waitForStatus(id: string, status: string) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        if (state.jobs.get(id)?.status === status) return
        await new Promise(resolve => setTimeout(resolve, 5))
    }
    throw new Error(`Verification job ${id} did not reach ${status}.`)
}
