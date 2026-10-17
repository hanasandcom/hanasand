import assert from 'node:assert/strict'
import test from 'node:test'
import config from '../src/config'
import { fetchTest } from '../src/utils/test/fetchTest'
import { fetchVisits } from '../src/utils/test/fetchVisits'

function replaceGlobal(name: string, value: unknown) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    return () => previous ? Object.defineProperty(globalThis, name, previous) : Reflect.deleteProperty(globalThis, name)
}

test('fetchTest uses its GET route and returns the parsed test', async () => {
    let request: { url: string, init?: RequestInit } | undefined
    const restoreFetch = replaceGlobal('fetch', async (url: string, init?: RequestInit) => {
        request = { url, init }
        return Response.json({ id: 'case-1', status: 'ready' })
    })
    try {
        assert.deepEqual(await fetchTest('case-1'), { id: 'case-1', status: 'ready' })
        assert.equal(request?.url, `${config.url.api}/test/case-1`)
        assert.equal(request?.init?.method, undefined)
        assert.ok(request?.init?.signal instanceof AbortSignal)
    } finally {
        restoreFetch()
    }
})

test('fetchVisits uses its route and projects visits from the response', async () => {
    let requestedUrl = ''
    const restoreFetch = replaceGlobal('fetch', async (url: string) => {
        requestedUrl = url
        return Response.json({ visits: 17 })
    })
    try {
        assert.equal(await fetchVisits(42), 17)
        assert.equal(requestedUrl, `${config.url.api}/test/visits/42`)
    } finally {
        restoreFetch()
    }
})

test('fetchTest preserves a successful JSON null without error logging', async () => {
    const errors: unknown[][] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => errors.push(values)
    const restoreFetch = replaceGlobal('fetch', async () => Response.json(null))
    try {
        assert.equal(await fetchTest('case-null'), null)
        assert.deepEqual(errors, [])
    } finally {
        restoreFetch()
        console.error = originalError
    }
})

test('fetchVisits catches and logs projection errors for successful JSON null', async () => {
    const errors: unknown[][] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => errors.push(values)
    const restoreFetch = replaceGlobal('fetch', async () => Response.json(null))
    try {
        assert.equal(await fetchVisits(42), null)
        assert.match(String(errors[0]?.[0]), /Error fetching test: TypeError/)
    } finally {
        restoreFetch()
        console.error = originalError
    }
})

test('non-OK responses preserve the null fallback and error logging', async () => {
    const errors: unknown[][] = []
    const originalError = console.error
    console.error = (...values: unknown[]) => errors.push(values)
    const restoreFetch = replaceGlobal('fetch', async () => new Response(null, { status: 503 }))
    try {
        assert.equal(await fetchTest('case-1'), null)
        assert.match(String(errors[0]?.[0]), /Error fetching test: Error: Failed to fetch test: 503/)
    } finally {
        restoreFetch()
        console.error = originalError
    }
})

test('timeout aborts the request, logs the timeout, and clears its timer', async () => {
    let abortTimer: (() => void) | undefined
    let timerDelay = 0
    let clearedTimer: unknown
    const errors: unknown[][] = []
    const originalError = console.error
    const restoreTimeout = replaceGlobal('setTimeout', ((callback: TimerHandler, delay?: number) => {
        abortTimer = callback as () => void
        timerDelay = delay || 0
        return 'test-timeout' as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout)
    const restoreClearTimeout = replaceGlobal('clearTimeout', ((timer: unknown) => { clearedTimer = timer }) as typeof clearTimeout)
    const restoreError = () => { console.error = originalError }
    console.error = (...values: unknown[]) => errors.push(values)
    const restoreFetch = replaceGlobal('fetch', async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    try {
        const result = fetchTest('case-timeout')
        abortTimer?.()
        assert.equal(await result, null)
        assert.equal(timerDelay, config.abortTimeout)
        assert.equal(clearedTimer, 'test-timeout')
        assert.deepEqual(errors, [[`Request timed out after ${config.abortTimeout}ms`]])
    } finally {
        restoreFetch()
        restoreClearTimeout()
        restoreTimeout()
        restoreError()
    }
})
