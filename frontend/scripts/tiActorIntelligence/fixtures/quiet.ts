import { buildActorIntelligence } from '../../../src/utils/ti/actorIntelligence'
import { buildTiActionability } from '../../../src/utils/ti/actionability'
import { buildActorArtifacts } from '../../../src/utils/ti/actorWorkbench'
import { fixture } from '../runtimeContext'

export const quietFixture: TiSearchResponse = {
    ...fixture,
    query: 'quiet-actor',
    summary: 'Quiet actor profile without current customer relevance.',
    confidence: 0.32,
    aliases: [],
    recentActivity: [],
    targets: [],
    ttps: [],
    sources: [],
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'not_alertable',
        shouldAlert: false,
        rationale: 'No current source, watchlist, alert, or case data is attached.',
        watchlistCandidates: [],
        relatedAlerts: [],
        relatedCases: [],
        sourceProvenance: [],
        enrichmentGaps: [],
    },
}
export const quietProfile = buildActorIntelligence(quietFixture, [])
export const quiet = buildTiActionability(quietFixture, quietProfile, [])
export const quietArtifacts = buildActorArtifacts(quietFixture, quietProfile, [], quiet)
