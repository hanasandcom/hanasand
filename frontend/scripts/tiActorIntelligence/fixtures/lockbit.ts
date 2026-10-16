import { buildActorIntelligence } from '../../../src/utils/ti/actorIntelligence'
import type { TiSearchResponse } from '../../../src/utils/ti/search'
import { fixture } from '../runtimeContext'

export const lockbitFixture: TiSearchResponse = {
    ...fixture,
    query: 'lockbit',
    summary: 'LockBit actor profile for extortion monitoring.',
    confidence: 0.62,
    lastSeen: '2026-07-04T23:05:00.028Z',
    aliases: ['LockBit', 'LockBit 3.0', 'LockBitSupp'],
    recentActivity: [{
        date: '2026-07-04T23:05:00.028Z',
        title: 'LockBit 3.0 actor profile updated',
        detail: 'Maintains actor context while monitored source captures update independently.',
        confidence: 0.66,
        sourceIds: ['src_lockbit_profile'],
        claimType: 'general_activity',
        affectedSectors: ['Enterprise company exposure'],
        countries: ['United States'],
        firstReportedAt: '2026-07-04T23:05:00.028Z',
    }],
    targets: [{
        sector: 'Enterprise company exposure',
        regions: ['Global'],
        rationale: 'Ransomware and extortion monitoring context from public actor reporting.',
        confidence: 0.62,
    }],
    ttps: [],
    datasets: [],
    sources: [{
        id: 'src_lockbit_profile',
        name: 'LockBit leak-site monitoring',
        type: 'public_ti',
        provenance: 'https://example.invalid/lockbit-profile',
        url: 'https://example.invalid/lockbit-profile',
    }],
    notes: [],
    actorIntelligence: undefined,
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'watchlist_required',
        shouldAlert: false,
        rationale: 'Actor monitoring is available, but authenticated organization context is required before alert or case creation.',
        watchlistCandidates: [
            { kind: 'company', value: 'LockBit', reason: 'Track ransomware and extortion actor mentions in monitored sources.', confidence: 0.62 },
        ],
        relatedAlerts: [],
        relatedCases: [],
        sourceProvenance: [],
        enrichmentGaps: [],
    },
}
export const lockbitProfile = buildActorIntelligence(lockbitFixture, [])
