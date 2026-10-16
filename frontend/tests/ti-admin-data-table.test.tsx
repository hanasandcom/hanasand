// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TiAdminOverview } from '../src/utils/tiAdmin/ops'
import type { TiEnrichmentOverview } from '../src/utils/tiAdmin/enrichment'
import { SourcesPanel } from '../src/app/dashboard/ti/sourceDeliveryPanels'
import { ActorEnrichmentPanel, RecentEvidencePanel } from '../src/app/dashboard/ti/evidenceEnrichmentPanels'

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
})
