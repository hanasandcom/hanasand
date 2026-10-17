// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TiAdminOverview } from '../src/utils/tiAdmin/ops'
import type { TiEnrichmentOverview } from '../src/utils/tiAdmin/enrichment'
import { DeliveryStatePanel, SourcesPanel } from '../src/app/dashboard/ti/sourceDeliveryPanels'
import { ActorEnrichmentPanel, RecentEvidencePanel } from '../src/app/dashboard/ti/evidenceEnrichmentPanels'
import { ActionItemsPanel } from '../src/app/dashboard/ti/actionItemsPanel'

const source = {
    id: 'feed-1', name: 'Threat feed', family: 'dark_web', status: 'active', nextRunAt: '2026-10-16T11:00:00Z',
    lastRunAt: '2026-10-16T10:00:00Z', retainedEvidenceCount: 2, domains: ['example.com'], resultTypes: ['actor'],
} as unknown as TiAdminOverview['sources'][number]

const actor = {
    id: 'actor-1', name: 'Example actor', status: 'queued', changedFields: [], confidence: 0.7,
    sourceLinks: [], lastUpdatedAt: null, nextRefreshAt: null,
} as unknown as TiEnrichmentOverview['updatedActors'][number]

function render(component: React.ReactElement) {
    return renderToStaticMarkup(component)
}

test('TI admin tables keep shared shell, headers, routes and body-specific empty states', () => {
    const sources = render(createElement(SourcesPanel, { sources: [source], runs: [], staleSources: [] }))
    const evidence = render(createElement(RecentEvidencePanel, { captures: [] }))
    const actors = render(createElement(ActorEnrichmentPanel, {
        enrichment: { updatedActors: [], queuedActors: [] } as unknown as TiEnrichmentOverview,
    }))
    const actorRow = render(createElement(ActorEnrichmentPanel, {
        enrichment: { updatedActors: [actor], queuedActors: [] } as unknown as TiEnrichmentOverview,
    }))

    for (const html of [sources, evidence, actors, actorRow]) {
        expect(html).toContain('overflow-hidden border-ui-border bg-ui-panel p-0')
        expect(html).toContain('min-w-full divide-y divide-ui-border text-sm')
        expect(html).toContain('bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted')
        expect(html).toContain('divide-y divide-ui-border bg-ui-panel')
        expect(html).not.toContain('text-white')
        expect(html).not.toMatch(/\b(?:bg|text|border|divide)-\[#/)
    }
    expect(sources).toContain('href="/ti/sources"')
    expect(sources).toContain('<th class="px-4 py-3">Matches</th>')
    expect(sources).toContain('Threat feed')
    expect(evidence).toContain('<th class="px-4 py-3">Captured</th>')
    expect(evidence).toContain('colSpan="4"')
    expect(evidence).toContain('Collectors are checking sources; accepted captures stream here.')
    expect(actors).toContain('href="/ti/profiles"')
    expect(actors).toContain('colSpan="6"')
    expect(actors).toContain('Actor profiles are updating. New profile changes appear here.')
    expect(actorRow).toContain('Example actor')
    expect(actorRow).toContain('<th class="px-4 py-3">Evidence strength</th>')
    expect(actorRow).toContain('>Moderate</td>')
    expect(actorRow).not.toContain('>70%</td>')
    expect(actorRow).toContain('text-ui-text')
})

test('delivery state renders themed rows with and without a latest collection', () => {
    const latestRun = {
        id: 'run-1', sourceId: 'feed-1', sourceName: 'Threat feed', sourceFamily: 'dark_web',
        sourceUrl: 'https://example.test', status: 'completed', startedAt: '2026-10-16T10:00:00Z',
        nextRunAt: '2026-10-16T11:00:00Z', rows: 4, captures: 2, screenshots: 0,
        message: '', trigger: 'automated',
    } as TiAdminOverview['runs'][number]
    const cases = [
        { latestRun, expectedCollection: 'completed ·' },
        { latestRun: undefined, expectedCollection: 'Selecting source' },
    ]

    for (const item of cases) {
        const html = render(createElement(DeliveryStatePanel, {
            reviewCount: 2, domainCount: 3, latestRun: item.latestRun,
        }))
        expect(html).toContain('overflow-hidden border-ui-border bg-ui-panel p-0')
        expect(html).toContain('border-ui-border bg-ui-canvas p-3')
        expect(html).toContain('text-ui-text')
        expect(html).not.toContain('text-white')
        expect(html).not.toMatch(/\b(?:bg|text|border|divide)-\[#/)
        for (const text of ['Delivery state', 'Matches detected', '2 entity matches', 'Webhook delivery', 'Delivery records are linked to dark web alerts', 'Customer routing', '3 monitored entities', 'Latest collection', item.expectedCollection]) {
            expect(html).toContain(text)
        }
        expect(html).toContain('href="/findings"')
    }
})

test('action items retain all five columns, statuses, badges, and their destination', () => {
    const html = render(createElement(ActionItemsPanel, {
        items: [
            { kind: 'run', priority: 'critical', tone: 'bad', title: 'run-42', reason: 'Source returned an error.', state: 'Started just now', href: '/ti/runs' },
            { kind: 'source', priority: 'stale', tone: 'watch', title: 'source-1', reason: 'Collection is late.', state: 'Last hour', href: '/ti/sources/source-1' },
        ],
        queuedCount: 2, latestRunStatus: 'blocked', latestRunTone: 'watch', actorUpdates: 4,
    }))

    expect(html).toContain('overflow-hidden border-ui-border bg-ui-panel p-0')
    expect(html).toContain('min-w-full divide-y divide-ui-border text-sm')
    expect((html.match(/<th\b/g) || [])).toHaveLength(5)
    for (const heading of ['Signal', 'Item', 'Details', 'State', 'Open']) expect(html).toContain(`>${heading}</th>`)
    expect(html).toContain('2 running/queued')
    expect(html).toContain('latest syncing')
    expect(html).toContain('4 actor updates 1h')
    expect(html).toContain('critical')
    expect(html).toContain('run-42')
    expect(html).toContain('Source returned an error.')
    expect(html).toContain('Started just now')
    expect(html).toContain('href="/ti/runs"')
    expect(html).toContain('href="/ti/sources/source-1"')
    expect(html).toContain('Open')
    expect(html.indexOf('run-42')).toBeLessThan(html.indexOf('source-1'))
})

test('action items retain the clear monitoring empty state and badges', () => {
    const html = render(createElement(ActionItemsPanel, {
        items: [], queuedCount: 0, latestRunStatus: 'ok', latestRunTone: 'ok', actorUpdates: 0,
    }))

    expect((html.match(/<th\b/g) || [])).toHaveLength(5)
    expect(html).toContain('overflow-x-auto')
    expect(html).toContain('Automated monitoring is clear; new signals are recorded automatically.')
    expect(html).toContain('0 running/queued')
    expect(html).toContain('latest ok')
    expect(html).toContain('0 actor updates 1h')
})
