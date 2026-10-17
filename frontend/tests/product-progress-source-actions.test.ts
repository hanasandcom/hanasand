import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { createCollectionActions } from '../src/app/dashboard/findings/workflow-collection-actions.ts'
import { createDeliveryActions } from '../src/app/dashboard/findings/workflow-delivery-actions.ts'
import { createEvidenceActions } from '../src/app/dashboard/findings/workflow-evidence-actions.ts'
import { createWatchlistActions } from '../src/app/dashboard/findings/workflow-watchlist-actions.ts'

function failureContext(events: string[]) {
    return {
        scope: { tenantId: 'tenant-1', organizationId: 'org-1' }, organizationId: 'org-1', variant: 'workflow',
        terms: 'Example Corp', setTerms() { events.push('terms') }, webhookUrl: 'https://hooks.example.test', webhookConfigured: true,
        claimUrl: 'https://source.example.test/report', setClaimUrl() { events.push('claim-url') },
        claimActor: 'Example Reporter', claimCompany: 'Example Corp', claimData: 'Customer records exposed',
        sourceTarget: '@example_feed', setSourceTarget() {},
        setBusyAction(value: string | null) { events.push(`busy:${value}`) },
        setResult(value: unknown) { events.push(value ? `result:${JSON.stringify(value)}` : 'result:clear') },
        setLastRoute() { events.push('route') }, onSaved() { events.push('saved') },
        refreshWorkspace() { events.push('refresh') }, navigateToCase() { events.push('navigate') },
    } as never
}

function installErrorResponse(message: string, onRequest?: (path: string) => void) {
    const previousFetch = globalThis.fetch
    globalThis.fetch = (async(input: RequestInfo | URL) => {
        onRequest?.(String(input))
        return { ok: false, statusText: 'Rejected', json: async() => ({ error: { message } }) } as Response
    }) as typeof fetch
    return () => { globalThis.fetch = previousFetch }
}

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
        assert.equal(state.busy, null)
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
    let busy: string | null = null
    globalThis.fetch = (async() => ({ ok: true, statusText: 'OK', json: async() => ({ source: { id: 'source-only' } }) })) as typeof fetch
    const actions = createCollectionActions({
        scope: { tenantId: 'tenant-1' }, terms: 'credential leak', sourceTarget: '@example_feed',
        setSourceTarget() {}, setBusyAction(value: string | null) { busy = value }, setResult(value: unknown) { result = value }, setLastRoute() {},
        refreshWorkspace() { refreshed += 1 },
    } as never)
    try {
        await actions.submitSource({ preventDefault() {} } as never)
        assert.deepEqual(result, { ok: false, message: 'No durable source request was returned.' })
        assert.equal(busy, null)
        assert.equal(refreshed, 0)
    } finally {
        globalThis.fetch = previousFetch
    }
})

test('invalid public evidence keeps validation feedback and clears the busy state without requesting', async() => {
    const busy: Array<string | null> = []
    let result: unknown
    const actions = createEvidenceActions({
        scope: { tenantId: 'tenant-1' }, organizationId: undefined, terms: '', setTerms() {},
        webhookUrl: '', webhookConfigured: false, claimUrl: 'not-a-url', setClaimUrl() {},
        claimActor: '', claimCompany: '', claimData: '', setSourceTarget() {}, setBusyAction(value: string | null) { busy.push(value) },
        setResult(value: unknown) { result = value }, setLastRoute() {}, refreshWorkspace() {}, navigateToCase() {},
    } as never, async() => { throw new Error('watchlist save should not run') })

    await actions.ingestPublicAdvisory({ preventDefault() {} } as never)

    assert.deepEqual(busy, ['claim', null])
    assert.deepEqual(result, { ok: false, message: 'Actor, affected company, exposure details, and an HTTPS source URL are required.' })
})

test('failed webhook delivery records its error and clears delivery busy state without success side effects', async() => {
    const events: string[] = []
    let requestPath = ''
    const restoreFetch = installErrorResponse('delivery rejected', path => { requestPath = path })
    try {
        const actions = createDeliveryActions(failureContext(events), 1, () => events.push('refresh'))
        await actions.deliverWebhooks()
        assert.equal(requestPath, '/api/findings/webhooks/deliver')
        assert.deepEqual(events, [
            'busy:delivery', 'result:clear', 'result:{"ok":false,"message":"delivery rejected"}', 'busy:null',
        ])
    } finally {
        restoreFetch()
    }
})

test('failed watchlist save records its error and clears busy state without mutating terms or refreshing', async() => {
    const events: string[] = []
    let requestPath = ''
    const restoreFetch = installErrorResponse('watchlist rejected', path => { requestPath = path })
    try {
        const actions = createWatchlistActions(failureContext(events))
        await actions.saveFromCommand()
        assert.equal(requestPath, '/api/findings/watchlists')
        assert.deepEqual(events, [
            'busy:watchlist', 'result:clear', 'result:{"ok":false,"message":"watchlist rejected"}', 'busy:null',
        ])
    } finally {
        restoreFetch()
    }
})

test('failed evidence intake records its error and clears busy state before watchlist or case side effects', async() => {
    const events: string[] = []
    let requestPath = ''
    const restoreFetch = installErrorResponse('evidence rejected', path => { requestPath = path })
    try {
        const actions = createEvidenceActions(failureContext(events), async() => {
            events.push('save-watchlist')
            return { ok: true, message: 'saved' }
        })
        await actions.ingestPublicAdvisory({ preventDefault() {} } as never)
        assert.equal(requestPath, '/api/findings/exposure-claims/ingest')
        assert.deepEqual(events, [
            'busy:claim', 'result:clear', 'result:{"ok":false,"message":"evidence rejected"}', 'busy:null',
        ])
    } finally {
        restoreFetch()
    }
})
