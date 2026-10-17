import assert from 'node:assert/strict'
// @ts-expect-error Bun provides this module when running tests.
import { mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TiEnrichmentOverview } from '../src/utils/tiAdmin/enrichmentTypes'

const overview: TiEnrichmentOverview = {
    generatedAt: '2026-10-17T10:00:00Z',
    dataAvailable: true,
    worker: {
        state: 'active', mode: 'automatic', intervalSeconds: 60, batchSize: 4,
        lastSweepStartedAt: null, lastSweepFinishedAt: null, lastError: null, cursor: 0,
    },
    updatedActors: [{
        id: 'actor-1', name: 'APT42', aliases: [], status: 'ready', confidence: 0.99,
        lastUpdatedAt: '2026-10-17T09:00:00Z', nextRefreshAt: '', changedFields: [],
        sourceLinks: [{ name: 'Source one', url: 'https://one.test' }, { name: 'Source two', url: 'https://two.test' }],
        automationEvidence: ['Evidence one', 'Evidence two', 'Evidence three'], plannedWork: [],
    }],
    queuedActors: [], activity: [], updates: [], auditLog: [],
    stats: {
        updatedLastHour: 1, queued: 0, auditedEvents: 0, automaticCoverage: 100,
        totalRefreshes: 1, profilesProcessed: 1, wordsAdded: 3, newFacts: 2,
        profilesChanged: 1, sourceRecords: 2, evidenceRecords: 3, failures: 0,
    },
}

mock.module('../src/utils/tiAdmin/enrichment', () => ({
    getTiEnrichmentOverview: async () => overview,
}))

const { default: TiEnrichmentPage } = await import('../src/app/dashboard/ti/enrichment/page')

test('TI enrichment page renders actor identity, evidence counts, and profile destination without confidence', async () => {
    const html = renderToStaticMarkup(await TiEnrichmentPage())

    assert.match(html, />APT42</)
    assert.match(html, /2 sources · 3 evidence rows/)
    assert.match(html, /href="\/ti\/apt42"/)
    assert.doesNotMatch(html, /confidence/i)
})
