import assert from 'node:assert/strict'
import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import type { TiSearchResponse } from '../src/utils/ti/search'

const emptyResult: TiSearchResponse = {
    query: 'APT29', queryKind: 'actor', generatedAt: '2026-07-21T09:53:53.332Z', mode: 'scraper',
    summary: '', confidence: 0.5, aliases: [], recentActivity: [], targets: [], ttps: [], datasets: [], sources: [], notes: [],
}

assert.equal(buildActorIntelligence(emptyResult, []).actorClass, '')
assert.equal(buildActorIntelligence({
    ...emptyResult,
    actorIdentity: { catalogMatched: true, ambiguous: false, activityEvidenceAvailable: false, candidates: [] },
}, []).actorClass, 'Named threat actor or activity cluster')
assert.equal(buildActorIntelligence({
    ...emptyResult,
    actorIntelligence: { actorClass: 'State-linked espionage actor' },
}, []).actorClass, 'State-linked espionage actor')

const emptyBusinessModel = {
    schemaVersion: 'ti.actor.business_model.v3' as const,
    evidenceState: 'not_observed' as const,
    publicationStrategies: [], publicityTactics: [], pressureTactics: [], communicationChannels: [],
    buyerSellerCommunications: [], intermediaryCommunications: [], monetizationPaths: [], profitabilitySignals: [],
    missingEvidence: [], evidenceBoundary: '',
}
const businessObservation = {
    value: 'Bitcoin payment requested', assertionKind: 'actor_claim', confidence: 0.8, sourceIds: ['source'],
    captureIds: ['capture'], reviewState: 'reviewed', reviewReasons: [],
}
for (const businessModel of [
    { ...emptyBusinessModel, paymentClaims: [businessObservation] },
    { ...emptyBusinessModel, extortionModels: [businessObservation] },
]) {
    const actor = buildActorIntelligence({ ...emptyResult, actorIntelligence: { businessModel } }, [])
    assert.equal(actor.actorClass, 'Named threat actor or activity cluster')
}
assert.equal(buildActorIntelligence({
    ...emptyResult,
    actorIntelligence: { businessModel: emptyBusinessModel },
}, []).actorClass, '')

const activity = {
    date: '2026-01-01', title: 'Observed campaign activity', detail: 'Classified activity.',
    confidence: 0.7, sourceIds: [],
}
assert.deepEqual(buildActorIntelligence({
    ...emptyResult,
    recentActivity: [{ ...activity, claimType: 'general_activity' }],
}, []).campaigns, [])
assert.deepEqual(buildActorIntelligence({
    ...emptyResult,
    recentActivity: [{ ...activity, claimType: 'campaign' }],
}, []).campaigns, ['Observed campaign activity'])
