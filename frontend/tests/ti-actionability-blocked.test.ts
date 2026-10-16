import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import { buildTiActionability } from '../src/utils/ti/actionability'
import type { TiSearchResponse } from '../src/utils/ti/search'
import { assert } from './fixtures/tiActionability'
// @ts-expect-error Bun provides this module when running tests.
import { test } from 'bun:test'

test('incomplete actor context reports typed relevance blockers', () => {

    const result: TiSearchResponse = {
        query: 'Unattributed Cluster',
        generatedAt: '2026-06-29T00:00:00.000Z',
        mode: 'seeded',
        status: 'partial',
        summary: 'Unattributed activity was returned without enough sourced actor context.',
        confidence: 0.34,
        lastSeen: '2025-01-01T00:00:00.000Z',
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: [],
        actionability: {
            schemaVersion: 'ti.query.actionability.v1',
            watchlistCandidates: [],
            watchlistMatches: [],
            relatedAlerts: [],
            relatedCases: [],
            sourceProvenance: [],
            enrichmentGaps: [],
        },
    }
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    const blocked = buildTiActionability(result, actor, victims)
    const gapCodes = blocked.orgRelevance.enrichmentGaps.map(gap => gap.code).sort()

    assert(blocked.orgRelevance.state === 'blocked', 'Incomplete actor relevance should be blocked.')
    assert(blocked.orgRelevance.actorIdentity.aliases.length === 0, 'Incomplete actor relevance should expose missing aliases.')
    assert(blocked.orgRelevance.sourceCoverage.length === 0, 'Incomplete actor relevance should expose missing source coverage.')
    assert(blocked.orgRelevance.watchlistIntersections.length === 0, 'Incomplete actor relevance should not invent org watchlist intersections.')
    assert(JSON.stringify(gapCodes) === JSON.stringify([
        'missing_actor_aliases',
        'missing_provenance',
        'missing_source_coverage',
        'missing_target_regions',
        'missing_target_sectors',
        'stale_evidence',
    ]), 'Incomplete actor relevance should expose the expected typed enrichment gaps.')
    assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:missing_actor_aliases:actorIdentity.aliases'), 'Missing alias gap should be visible as a handoff row.')
    assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:missing_source_coverage:sourceCoverage'), 'Missing source coverage gap should be visible as a handoff row.')
    assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:stale_evidence:freshness.lastSeen'), 'Stale evidence gap should be visible as a handoff row.')
})
