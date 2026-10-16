import { expect, test } from 'bun:test'
import { analystWorkItemsFor } from '../src/app/ti/analystWorkItems'
import { apt29WithHostedCopyResidue } from './fixtures/tiHostedCopyResidue'
import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import { buildTiActionability } from '../src/utils/ti/actionability'
import {
    alertPacketFor,
    selectedAlertActionPlanFor,
    selectedCaseActionTrailFor,
    selectedCaseCreateRequestFor,
    selectedCaseDraftFor,
    selectedCaseOwnershipFor,
    selectedDeliveryReadinessPlanFor,
    selectedEnrichmentTriageFor,
    selectedReviewHandoffFor,
    selectedSourceDrilldownFor,
    selectedWatchlistPlanFor,
    watchlistRelevanceFor,
} from '../src/app/ti/pageModel'
import { createTiSafeOutputMetadata } from '../src/app/ti/model/safeOutput'

test('all public TI plans share the metadata-only output boundary', () => {
    const result = apt29WithHostedCopyResidue()
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    const actionability = buildTiActionability(result, actor, victims)
    const selected = analystWorkItemsFor(result, victims, new Map(), actionability)[0]
    expect(selected).toBeDefined()
    if (!selected) return

    const watchlist = watchlistRelevanceFor(result, victims, result.sources, actor, actionability)
    const alertPacket = alertPacketFor(result, selected, watchlist)
    const drilldown = selectedSourceDrilldownFor(result, selected, actionability, actor)
    const relevance = undefined
    const draft = selectedCaseDraftFor(result, selected, watchlist, alertPacket, actionability, drilldown, relevance, '')
    const review = selectedReviewHandoffFor(result, selected, watchlist, alertPacket, actionability, undefined, relevance, '')
    const trail = selectedCaseActionTrailFor(result, selected, actionability, review, draft, undefined, relevance, '')
    const watchlistPlan = selectedWatchlistPlanFor(result, selected, actionability, watchlist, relevance)
    const alertPlan = selectedAlertActionPlanFor(result, selected, actionability, watchlist, draft, relevance)
    const enrichment = selectedEnrichmentTriageFor(result, selected, actionability, drilldown)
    const ownership = selectedCaseOwnershipFor(result, selected, actionability, draft, trail)
    const caseRequest = selectedCaseCreateRequestFor(result, selected, actor, actionability, draft, ownership, drilldown, watchlistPlan)
    const delivery = selectedDeliveryReadinessPlanFor(result, selected, actionability, alertPlan, ownership)
    const expected = createTiSafeOutputMetadata()

    expect([
        trail.safeOutput,
        watchlistPlan.safeOutput,
        alertPlan.safeOutput,
        enrichment.safeOutput,
        ownership.safeOutput,
        caseRequest.safeOutput,
        delivery.safeOutput,
    ]).toEqual(Array.from({ length: 7 }, () => expected))
})
