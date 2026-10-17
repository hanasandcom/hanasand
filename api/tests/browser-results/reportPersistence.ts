import { expect, test } from 'bun:test'
import { handlers, records, state } from './fixture.ts'

test('archive retains all screenshots and untruncated text independently of client report limits', async () => {
    const text = 'Long line\n'.repeat(2000)
    const events = [...Array.from({ length: 35 }, (_, index) => ({ type: 'frame', image: String(index), url: 'https://vg.no/', evidence: { textExcerpt: text } })), { type: 'console', text, level: 'info' }]
    const report = handlers.buildStoredBrowserReport(records[0], { captures: [] }, events, records)
    expect(report.captures).toHaveLength(35)
    expect(report.consoleEvents[0]).toBe(`[info] ${text}`)
    await handlers.persistBrowserRunEvidence('new', events[0])
    expect(JSON.parse(String(state.inserted[1])).evidence.textExcerpt).toBe(text)
    state.inserted = []
    await handlers.persistBrowserRunEvidence('new', { type: 'stream_ready', streamUrl: 'private capability' })
    expect(state.inserted).toHaveLength(0)
})

test('saved location follows the observed IP and keeps enrichment through later network events', () => {
    const first = { url: 'https://example.com', ip: '1.1.1.1', country: 'Australia', country_code: 'AU' }
    const next = { url: first.url, ip: '8.8.8.8', country: 'United States', country_code: 'US' }
    const events = [
        { type: 'frame', networkSummary: { site: first } },
        { type: 'frame', networkSummary: { site: next } },
        { type: 'downloads', networkSummary: { site: { url: next.url, ip: next.ip } } },
    ]
    expect(handlers.buildStoredBrowserReport(records[0], {}, events, []).siteNetwork).toEqual(next)
    expect(handlers.buildStoredBrowserReport(records[0], {}, events.slice(0, 1), []).siteNetwork).toEqual(first)
})
