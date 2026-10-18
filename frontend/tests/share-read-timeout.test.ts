import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { afterEach, beforeEach, test } from 'bun:test'
import config from '../src/config'
import withAbortTimeout from '../src/utils/share/withAbortTimeout'
import { getShare } from '../src/utils/share/get'
import { getTree } from '../src/utils/share/getTree'
import getProject from '../src/utils/projects/getProject'

type TimerRecord = { callback: () => void, delay: number, cleared: boolean }
type CapturedRequest = { url: string, init?: RequestInit }

const originalFetch = globalThis.fetch
const originalSetTimeout = globalThis.setTimeout
const originalClearTimeout = globalThis.clearTimeout
const timers: TimerRecord[] = []
const requests: CapturedRequest[] = []
let fetchResponse: Response = Response.json({})
let fetchFailure: Error | null = null

function reset() {
    timers.length = 0
    requests.length = 0
    fetchResponse = Response.json({})
    fetchFailure = null
}

beforeEach(() => {
    reset()
    globalThis.setTimeout = ((callback: () => void, delay = 0) => {
        const timer = { callback, delay, cleared: false }
        timers.push(timer)
        return timer as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout
    globalThis.clearTimeout = ((timer: unknown) => {
        const record = timers.find(item => item === timer)
        if (record) record.cleared = true
    }) as typeof clearTimeout
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        if (fetchFailure) throw fetchFailure
        return fetchResponse.clone()
    }) as typeof fetch
})

afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
})

test('abort timeout covers the operation and clears after success or failure', async () => {
    let observedSignal: AbortSignal | undefined
    let finish: ((value: string) => void) | undefined
    const pending = withAbortTimeout(123, signal => {
        observedSignal = signal
        return new Promise<string>(resolve => { finish = resolve })
    })

    assert.ok(observedSignal)
    assert.equal(timers[0]?.delay, 123)
    assert.equal(timers[0]?.cleared, false)
    timers[0]?.callback()
    assert.equal(observedSignal.aborted, true)
    finish?.('done')
    assert.equal(await pending, 'done')
    assert.equal(timers[0]?.cleared, true)

    await assert.rejects(withAbortTimeout(456, async () => { throw new Error('fetch failed') }), /fetch failed/)
    assert.equal(timers[1]?.delay, 456)
    assert.equal(timers[1]?.cleared, true)
})

test('share and tree requests preserve endpoint options and timeout through JSON parsing', async () => {
    fetchResponse = Response.json({ id: 'share-1' })
    assert.deepEqual(await getShare({ id: 'share-1', token: 'token-1', userId: 'user-1' }), { id: 'share-1' })
    assert.deepEqual(await getTree({ id: 'share-1', token: 'token-1', userId: 'user-1' }), { id: 'share-1' })

    assert.deepEqual(requests.map(({ url }) => url), [
        `${config.url.api}/share/share-1`,
        `${config.url.api}/share/tree/share-1`,
    ])
    assert.deepEqual(requests.map(({ init }) => init && ({ headers: init.headers, cache: init.cache })), [
        { headers: { Authorization: 'Bearer token-1', id: 'user-1' }, cache: 'no-store' },
        { headers: { Authorization: 'Bearer token-1', id: 'user-1' }, cache: 'no-store' },
    ])
    assert.ok(requests.every(({ init }) => init?.signal instanceof AbortSignal))
    assert.deepEqual(timers.map(({ delay, cleared }) => ({ delay, cleared })), [
        { delay: Math.max(config.abortTimeout, 10000), cleared: true },
        { delay: Math.max(config.abortTimeout, 10000), cleared: true },
    ])
})

test('share body parsing stays timed while project parsing keeps its fetch-only timeout boundary', async () => {
    let resolveShareBody: ((value: { id: string }) => void) | undefined
    fetchResponse = responseWithPendingJson(() => new Promise(resolve => { resolveShareBody = resolve }))
    const pendingShare = getShare({ id: 'slow-share' })
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(timers[0]?.cleared, false)
    resolveShareBody?.({ id: 'slow-share' })
    assert.deepEqual(await pendingShare, { id: 'slow-share' })
    assert.equal(timers[0]?.cleared, true)

    reset()
    let resolveProjectBody: ((value: { tree: unknown[], share: { id: string } }) => void) | undefined
    fetchResponse = responseWithPendingJson(() => new Promise(resolve => { resolveProjectBody = resolve }))
    const pendingProject = getProject({ alias: 'slow-project' })
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(timers[0]?.cleared, true)
    resolveProjectBody?.({ tree: [], share: { id: 'slow-project' } })
    assert.deepEqual(await pendingProject, { tree: [], share: { id: 'slow-project' } })
})

test('project request retains its response validation and clears timeout after fetch rejection', async () => {
    fetchResponse = Response.json({ tree: [{ id: 'root' }], share: { id: 'project-1' } })
    assert.deepEqual(await getProject({ alias: 'project-1', token: 'token-1', userId: 'user-1' }), {
        tree: [{ id: 'root' }], share: { id: 'project-1' },
    })
    assert.equal(requests[0]?.url, `${config.url.api}/project/project-1`)
    assert.deepEqual(requests[0]?.init?.headers, { Authorization: 'Bearer token-1', id: 'user-1' })
    assert.ok(requests[0]?.init?.signal instanceof AbortSignal)
    assert.deepEqual(timers.map(({ delay, cleared }) => ({ delay, cleared })), [
        { delay: Math.max(config.abortTimeout, 10000), cleared: true },
    ])

    reset()
    fetchFailure = new Error('connection failed')
    const originalError = console.error
    console.error = () => undefined
    try {
        assert.equal(await getProject({ alias: 'unreachable' }), null)
    } finally {
        console.error = originalError
    }
    assert.equal(timers[0]?.cleared, true)
})

function responseWithPendingJson<T>(json: () => Promise<T>): Response {
    const response = {
        status: 200,
        ok: true,
        json,
        clone: () => response,
    }
    return response as unknown as Response
}
