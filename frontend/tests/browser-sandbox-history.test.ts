import { strict as assert } from 'node:assert'
import test from 'node:test'
import { sanitizeHistory } from '../src/app/browser/historyData'
import { fetchPagedBrowserHistory, fetchRecentBrowserHistory } from '../src/app/browser/historyApi'

const originalFetch = globalThis.fetch

test.afterEach(() => { globalThis.fetch = originalFetch })

test('recent browser history keeps the newest duplicate target without discarding other URLs on that domain', () => {
    const history = sanitizeHistory([
        { id: 'first-vg', target: 'https://vg.no/first', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:00:00.000Z' },
        { id: 'older-run', target: 'https://vg.no/latest', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:30:00.000Z' },
        { id: 'example', target: 'https://example.com/', network: 'regular', status: 'ended', startedAt: '2026-07-14T05:45:00.000Z' },
        { id: 'latest-run', target: 'https://vg.no/latest', network: 'regular', status: 'ended', startedAt: '2026-07-14T06:00:00.000Z' },
    ])

    assert.deepEqual(history.map(run => run.id), ['latest-run', 'example', 'first-vg'])
})

test('paged history keeps every run and uses the all-history contract without quota', async () => {
    let requestUrl = ''
    let requestOptions: RequestInit | undefined
    const runs = Array.from({ length: 14 }, (_, index) => ({
        id: `run-${index}`,
        resultId: `result-${index}`,
        target: `https://example.com/${index}`,
        network: 'regular',
        status: 'ended',
        startedAt: '2026-07-14T06:00:00.000Z',
    }))
    globalThis.fetch = (async (url, options) => {
        requestUrl = String(url)
        requestOptions = options
        return Response.json({ runs, nextOffset: 50, quota: { used: 9 } })
    }) as typeof fetch

    const controller = new AbortController()
    const page = await fetchPagedBrowserHistory('client & id', 50, controller.signal)

    assert.deepEqual(page.runs.map(run => run.id), runs.map(run => run.id))
    assert.equal(page.nextOffset, 50)
    assert.equal('quota' in page, false)
    const url = new URL(requestUrl, 'https://local.test')
    assert.equal(url.pathname, '/api/backend/browser/runs')
    assert.equal(url.searchParams.get('history'), 'all')
    assert.equal(url.searchParams.get('offset'), '50')
    assert.equal(url.searchParams.get('clientId'), 'client & id')
    assert.equal(requestOptions?.credentials, 'include')
    assert.equal(requestOptions?.signal, controller.signal)
    assert.equal(requestOptions?.cache, undefined)
})

test('recent history keeps its quota payload and no-store request contract', async () => {
    let requestUrl = ''
    let requestOptions: RequestInit | undefined
    const runs = [{ id: 'recent', target: 'https://example.com', network: 'regular', status: 'ended', startedAt: '2026-07-14T06:00:00.000Z' }]
    const quota = { plan: 'paid', used: 3 }
    globalThis.fetch = (async (url, options) => {
        requestUrl = String(url)
        requestOptions = options
        return Response.json({ runs, quota })
    }) as typeof fetch

    const result = await fetchRecentBrowserHistory('client & id')

    assert.deepEqual(result, { runs, quota })
    assert.equal(requestUrl, '/api/backend/browser/runs?clientId=client%20%26%20id')
    assert.equal(requestOptions?.credentials, 'include')
    assert.equal(requestOptions?.cache, 'no-store')
})

test('paged contract drops malformed rows and rejects invalid offsets safely', async () => {
    globalThis.fetch = (async () => Response.json({
        runs: [{ id: 'missing-target' }, { id: 'valid', resultId: 'result', target: 'https://example.com' }],
        nextOffset: '50',
    })) as typeof fetch

    const page = await fetchPagedBrowserHistory('client', 0, new AbortController().signal)

    assert.deepEqual(page.runs.map(run => run.id), ['valid'])
    assert.equal(page.nextOffset, null)
})
