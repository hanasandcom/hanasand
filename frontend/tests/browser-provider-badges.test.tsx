// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProviderBadges } from '../src/app/browser/components/ProviderBadges'
import { HistoryPanel } from '../src/app/browser/components/RunHistoryPanel'
import type { BrowserRunHistory } from '../src/app/browser/types'

const results = {
    virustotal: { status: 'suspicious' as const, label: 'VT: 2' },
    urlquery: { status: 'blocked' as const, label: 'urlquery: 3 alerts' },
}

const render = (element: React.ReactElement) => renderToStaticMarkup(element)

test('browser run history uses the shared provider labels, icons and accessible status', () => {
    const direct = render(createElement(ProviderBadges, { results }))
    const run: BrowserRunHistory = {
        id: 'run-1',
        resultId: 'result-1',
        target: 'example.com',
        network: 'regular',
        status: 'completed',
        startedAt: '2026-10-16T12:00:00.000Z',
        providerResults: results,
    }

    const history = render(createElement(HistoryPanel, {
        history: [run], quota: null, historyReady: true,
        onDelete: async () => {}, onShare: async () => '',
    }))

    expect(history).toContain(direct)
    expect(direct).toContain('aria-label="VirusTotal: 2"')
    expect(direct).toContain('title="VirusTotal: 2"')
    expect(direct).toContain('aria-label="urlquery: 3 alerts"')
    expect(direct).toContain('src="/logos/virustotal.svg"')
    expect(direct).toContain('src="/logos/urlquery.png"')
    expect(direct).toContain('border-ui-warning/40 bg-ui-warning/10 text-ui-warning')
    expect(direct).toContain('aria-hidden="true">2</span>')
})

test('missing and clean results keep the clean zero state while loading stays visible', () => {
    const empty = render(createElement(ProviderBadges, {}))
    expect(empty).toContain('aria-label="VirusTotal: 0"')
    expect(empty).toContain('aria-label="urlquery: 0 alerts"')
    expect(empty).toContain('border-ui-success/35 bg-ui-success/10 text-ui-success')

    const clean = render(createElement(ProviderBadges, {
        results: { virustotal: { status: 'clean', label: 'VirusTotal: clean' } },
    }))
    expect(clean).toContain('aria-label="VirusTotal: clean"')
    expect(clean).toContain('aria-label="urlquery: 0 alerts"')

    const loading = render(createElement(ProviderBadges, {
        results: { virustotal: { status: 'loading', label: 'VT: checking' } },
    }))
    expect(loading).toContain('aria-label="VirusTotal: checking"')
    expect(loading).toContain('border-ui-warning/40 bg-ui-warning/10 text-ui-warning')
})
