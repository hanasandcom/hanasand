import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { TiActionabilityModel, PublicTiReadinessContract, PublicTiReadinessBlocker } from './types/actionability'
import type { ConsumerReadinessContract } from './types/readiness'
import { uniqueStrings, uniqueBy } from './geography'
import { readTermArray } from './normalization'

export function buildPublicTiStatus(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    contract: TiActionabilityContract | undefined
    exportPayloads: TiActionabilityModel['exportPayloads']
    consumerReadiness: ConsumerReadinessContract
}): PublicTiReadinessContract {
    const tenantIds = uniqueStrings([
        ...input.matches.map(match => match.tenantId),
        ...input.relatedAlerts.map(alert => alert.tenantId),
    ])
    const organizationIds = uniqueStrings([
        ...input.matches.map(match => match.organizationId),
        ...input.relatedAlerts.map(alert => alert.organizationId),
    ])
    const watchlistIds = uniqueStrings(input.matches.map(match => match.watchlistId))
    const watchlistItemIds = uniqueStrings(input.matches.map(match => match.watchlistItemId))
    const alertIds = uniqueStrings(input.relatedAlerts.map(alert => alert.id))
    const caseIds = uniqueStrings([
        ...input.relatedCases.map(item => item.id),
        ...input.relatedAlerts.map(alert => alert.caseIdCandidate),
    ])
    const casePaths = uniqueStrings([
        ...input.relatedCases.map(item => item.path),
        ...input.relatedAlerts.map(alert => alert.casePath),
        ...input.relatedAlerts.map(alert => alert.deliveryReadinessContext?.casePath),
    ])
    const captureIds = uniqueStrings([
        ...input.sourceProvenance.map(source => source.captureId),
        ...input.relatedAlerts.flatMap(alert => alert.captureIds ?? []),
        ...input.relatedAlerts.flatMap(alert => alert.deliveryReadinessContext?.selectedCaptureIds ?? []),
    ])
    const webhookDestinationIds = uniqueStrings([
        ...(input.contract?.relatedWebhookDestinations ?? []).filter(destination => destination.status === 'active').map(destination => destination.id),
        ...input.relatedAlerts.flatMap(alert => alert.webhookDestinationIds ?? []),
        ...input.relatedAlerts.flatMap(alert => alert.deliveryReadinessContext?.webhookDestinationIds ?? []),
    ])
    const blockers: PublicTiReadinessBlocker[] = []
    const hasWatchlistTerms = readTermArray(input.exportPayloads.watchlist.body.terms).length > 0
    const hasOrgContext = organizationIds.length > 0
    const hasAlertContext = alertIds.length > 0

    if (!hasOrgContext) blockers.push(statusBlocker('missing_org', 'watchlist', 'org', 'watchlistMatches[].organizationId', 'Organization context is required before watchlist, alert, case, or delivery handoff can mutate customer state.', '/findings', 'Open the authenticated console and choose the customer organization before saving watchlist terms.', 'consumer_readiness'))
    if (!watchlistIds.length || !watchlistItemIds.length) blockers.push(statusBlocker('missing_org_watchlist', 'watchlist', 'org', 'watchlistMatches[].watchlistId', hasWatchlistTerms ? 'Candidate watchlist terms exist, but no persisted organization watchlist item is attached.' : 'No candidate or persisted organization watchlist term is attached to this result.', '/findings', hasWatchlistTerms ? 'Create or select the customer watchlist, then rebuild alerts from the saved items.' : 'Collect a customer-relevant company, domain, vendor, or sector term before rebuilding alerts.', 'consumer_readiness'))
    if (!input.sourceProvenance.length) blockers.push(statusBlocker('missing_source_provenance', 'source', 'source', 'sourceProvenance[]', 'No source detail row is attached to this result.', '/ti/profiles', 'Attach source name, source ID, source URL, report date, and confidence before using this result for alerting.', 'public_result'))
    if (input.actor.freshness.stale) blockers.push(statusBlocker('stale_provenance', 'public_ti', 'public-ti', 'actorIntelligence.freshness', input.actor.freshness.reason, '/ti/profiles', 'Refresh the actor profile or attach newer corroborating evidence before sending this to review.', 'public_result'))
    if (!alertIds.length) blockers.push(statusBlocker('missing_alert', 'alert', 'alert', 'relatedAlerts[].id', 'No generated alert ID is attached to this actor result.', '/findings', 'Rebuild alerts from persisted watchlist items and return the alert ID.', 'consumer_readiness'))
    if (!captureIds.length) blockers.push(statusBlocker('missing_capture', 'source', 'source', 'sourceProvenance[].captureId', 'No replayable capture ID is attached for case evidence or delivery dry-run.', '/ti/profiles', 'Attach capture IDs or source request IDs to the source rows.', 'consumer_readiness'))
    if (!casePaths.length) blockers.push(statusBlocker('missing_case_route', 'case', 'case', 'relatedCases[].path', 'No case route or case path is attached to this result.', '/ti/workbench', 'Return relatedCases[].path or relatedAlerts[].casePath after case creation is available.', 'consumer_readiness'))
    if (!webhookDestinationIds.length) blockers.push(statusBlocker('missing_webhook_destination', 'webhook', 'webhook', 'relatedWebhookDestinations[].id', 'No active webhook destination ID is attached for dry-run delivery.', '/findings', 'Attach an active webhook destination before preparing customer delivery.', 'consumer_readiness'))

    if (hasOrgContext && !input.contract?.entitlementReadiness) {
        blockers.push(statusBlocker('unavailable_contract', 'entitlement', 'entitlement', 'actionability.entitlementReadiness', 'Organization access context is not attached to the public TI result.', '/findings', 'Load organization access context before enabling watchlist, alert, case, or delivery mutation.', 'entitlement_readiness'))
    }
    if (hasAlertContext && input.relatedAlerts.every(alert => !alert.deliveryReadinessContext)) {
        blockers.push(statusBlocker('unavailable_contract', 'webhook', 'webhook', 'relatedAlerts[].deliveryReadinessContext', 'Alert delivery context is not attached to the related alert.', '/findings', 'Attach delivery context with capture, case, destination, replay, and entitlement fields.', 'delivery_readiness'))
    }

    const entitlementActions = Object.values(input.contract?.entitlementReadiness?.actions ?? {})
    for (const action of entitlementActions.filter(action => action.status === 'blocked')) {
        const blockerCode = action.blockerCodes?.[0] ?? action.blockers?.[0]?.blockerCode ?? 'entitlement_blocked'
        blockers.push(statusBlocker('entitlement_blocked', 'entitlement', 'entitlement', `entitlementReadiness.actions.${action.ownerLane ?? 'action'}`, action.dashboardText || action.blockers?.[0]?.dashboardText || `Entitlement blocked ${blockerCode}.`, action.route || action.blockers?.[0]?.route || '/findings', action.helpdeskText || action.blockers?.[0]?.supportText || 'Review organization entitlement limits before retrying this handoff.', 'entitlement_readiness'))
    }

    for (const alert of input.relatedAlerts) {
        for (const code of alert.deliveryReadinessContext?.blockerCodes ?? []) {
            if (code === 'missing_capture_evidence') blockers.push(statusBlocker('missing_capture', 'source', 'source', `relatedAlerts.${alert.id}.deliveryReadinessContext.selectedCaptureIds`, 'Delivery readiness reports missing capture evidence.', '/ti/profiles', 'Attach capture IDs and evidence count before delivery or replay.', 'delivery_readiness'))
            if (code === 'case_route_unavailable') blockers.push(statusBlocker('missing_case_route', 'case', 'case', `relatedAlerts.${alert.id}.deliveryReadinessContext.casePath`, 'Delivery readiness reports that the case route is unavailable.', '/ti/workbench', 'Return case path and case ID candidate from the case workflow before handoff.', 'delivery_readiness'))
            if (code === 'delivery_disabled') blockers.push(statusBlocker('missing_webhook_destination', 'webhook', 'webhook', `relatedAlerts.${alert.id}.deliveryReadinessContext.webhookDestinationIds`, 'Delivery readiness reports that webhook delivery is not configured.', '/findings', 'Attach an active webhook destination or mark delivery intentionally disabled.', 'delivery_readiness'))
            if (code === 'entitlement_denied') blockers.push(statusBlocker('entitlement_blocked', 'entitlement', 'entitlement', `relatedAlerts.${alert.id}.deliveryReadinessContext.entitlement`, 'Delivery readiness reports an entitlement denial.', '/findings', 'Resolve organization entitlement before replay, delivery, or alert rebuild.', 'delivery_readiness'))
        }
    }

    const uniqueBlockers = uniqueBy(blockers, blocker => `${blocker.code}:${blocker.stage}:${blocker.field}`)
    const hasWorkableEvidence = input.sourceProvenance.length > 0 || hasWatchlistTerms || input.matches.length > 0 || hasAlertContext
    const state: PublicTiReadinessContract['state'] = uniqueBlockers.length === 0
        ? 'ready'
        : uniqueBlockers.some(blocker => blocker.code === 'entitlement_blocked' || blocker.code === 'missing_source_provenance') && !hasWorkableEvidence ? 'blocked'
            : hasWorkableEvidence ? 'degraded' : 'blocked'

    return {
        schemaVersion: 'ti.public_actor.readiness.v1',
        state,
        generatedAt: input.result.generatedAt,
        backedIds: {
            tenantIds,
            organizationIds,
            watchlistIds,
            watchlistItemIds,
            alertIds,
            caseIds,
            casePaths,
            captureIds,
            webhookDestinationIds,
        },
        blockers: uniqueBlockers,
    }
}

export function statusBlocker(code: PublicTiReadinessBlocker['code'], stage: PublicTiReadinessBlocker['stage'], ownerLane: PublicTiReadinessBlocker['ownerLane'], field: string, detail: string, route: string, handoff: string, source: PublicTiReadinessBlocker['source']): PublicTiReadinessBlocker {
    return {
        schemaVersion: 'ti.public_actor.readiness_blocker.v1',
        code,
        stage,
        ownerLane,
        field,
        detail,
        handoff,
        route,
        recoverable: code !== 'stale_provenance',
        source,
    }
}
