import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { createCollectionActions } from '../src/app/dashboard/findings/workflow-collection-actions.ts'

test('dashboard source request and canary actions require durable results and preserve tenant scope', async() => {
    const previousFetch = globalThis.fetch
    const calls: Array<{ path: string, init: RequestInit }> = []
    const replies = [
        { ok: true, statusText: 'OK', payload: { request: { id: 'request-1' }, source: { id: 'source-1' } } },
        { ok: true, statusText: 'OK', payload: { canaryRun: { insertedCaptureCount: 3 } } },
        { ok: true, statusText: 'OK', payload: { savedAlertCount: 1, alertIds: ['alert-1'] } },
    ]
    globalThis.fetch = (async(input: RequestInfo | URL, init: RequestInit = {}) => {
        calls.push({ path: String(input), init })
        const reply = replies.shift()!
        return { ...reply, json: async() => reply.payload } as Response
    }) as typeof fetch

    const state: Record<string, unknown> = { sourceTarget: '@example_feed', busy: null, result: null, lastRoute: null, refreshed: 0 }
    const setState = (key: string) => (value: unknown) => {
        state[key] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[key]) : value
    }
    const actions = createCollectionActions({
        scope: { tenantId: 'tenant-1', organizationId: 'org-1' }, terms: 'credential leak', sourceTarget: state.sourceTarget,
        setSourceTarget: setState('sourceTarget'), setBusyAction: setState('busy'), setResult: setState('result'), setLastRoute: setState('lastRoute'),
        refreshWorkspace: () => { state.refreshed = Number(state.refreshed) + 1 },
    } as never)

    try {
        await actions.submitSource({ preventDefault() {} } as never)
        assert.equal(calls[0].path, '/api/findings/source-requests')
        assert.equal(calls[0].init.method, 'POST')
        assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
            tenantId: 'tenant-1', organizationId: 'org-1', target: '@example_feed', type: 'telegram_channel',
            priority: 'high', scope: 'credential leak', activate: false,
        })
        assert.deepEqual(state.result, { ok: true, message: 'Telegram source submitted for review.' })
        assert.equal(state.sourceTarget, '')
        assert.equal(state.refreshed, 1)

        await actions.runCollection()
        assert.equal(calls[1].path, '/api/findings/canary/run')
        assert.equal(calls[1].init.method, 'POST')
        assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
            tenantId: 'tenant-1', organizationId: 'org-1', operatorApproval: true, approvedBy: 'dashboard', maxSources: 12, maxTasks: 24,
        })
        assert.equal(calls[2].path, '/api/findings/alerts/rebuild')
        assert.equal(calls[2].init.method, 'POST')
        assert.deepEqual(JSON.parse(String(calls[2].init.body)), { tenantId: 'tenant-1', organizationId: 'org-1' })
        assert.deepEqual(state.lastRoute, { label: 'Collection run', watchTerms: 1, captureCount: 3, alertCount: 1 })
        assert.deepEqual(state.result, { ok: true, message: 'Collected 3 Telegram captures. Matched 1 events.' })
        assert.equal(state.refreshed, 2)
        assert.equal(state.busy, null)
    } finally {
        globalThis.fetch = previousFetch
    }
})

test('dashboard does not report a source request as saved without a durable request identifier', async() => {
    const previousFetch = globalThis.fetch
    let refreshed = 0
    let result: unknown
    globalThis.fetch = (async() => ({ ok: true, statusText: 'OK', json: async() => ({ source: { id: 'source-only' } }) })) as typeof fetch
    const actions = createCollectionActions({
        scope: { tenantId: 'tenant-1' }, terms: 'credential leak', sourceTarget: '@example_feed',
        setSourceTarget() {}, setBusyAction() {}, setResult(value: unknown) { result = value }, setLastRoute() {},
        refreshWorkspace() { refreshed += 1 },
    } as never)
    try {
        await actions.submitSource({ preventDefault() {} } as never)
        assert.deepEqual(result, { ok: false, message: 'No durable source request was returned.' })
        assert.equal(refreshed, 0)
    } finally {
        globalThis.fetch = previousFetch
    }
})
