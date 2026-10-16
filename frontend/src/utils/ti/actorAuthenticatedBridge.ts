import type { TiSearchResponse } from './search'
import { encodeHandoffPayload } from './publicTiHandoffCodec'
import { labelForHandoffAction, selectedPayloadForAction } from './publicTiHandoffValues'
import { unique } from './actorArtifactUtils'
import { blockersForBridge, evidenceRefsFor, actionReadinessFor, sourceRequestsFor } from './publicTiHandoffEvidence'
import { PUBLIC_TI_HANDOFF_ACTIONS, PUBLIC_TI_HANDOFF_ROUTES, PUBLIC_TI_HANDOFF_SCHEMA_VERSION, PUBLIC_TI_HANDOFF_SOURCE } from './actorWorkbenchTypes'
import type { ActorArtifact, ActorArtifactHandoffs, AuthenticatedArtifactBridge, PublicTiHandoffAction, PublicTiHandoffArtifact, PublicTiHandoffPayload } from './actorWorkbenchTypes'

export function buildAuthenticatedBridge(
    result: TiSearchResponse,
    artifact: ActorArtifact,
    payloads: Pick<ActorArtifactHandoffs, 'watchlist' | 'alertRebuild' | 'case' | 'enrichment'>
): AuthenticatedArtifactBridge {
    const compactArtifact = {
        id: artifact.id,
        kind: artifact.kind,
        label: artifact.label,
        confidence: artifact.confidence,
        freshness: artifact.freshness,
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        watchlistTerms: artifact.watchlistTerms,
        enrichmentTasks: artifact.enrichmentTasks,
        readiness: artifact.readiness,
    }
    const missing = unique([
        ...artifact.readiness.blockers,
        ...payloads.watchlist.missing,
        ...payloads.case.missing,
    ])
    const orgRequired = missing.some(item => /organization|org|member|admin/i.test(item))
    const sourceRequired = missing.some(item => /source|provenance|capture|url/i.test(item))
    const stale = artifact.readiness.state === 'stale'
    const actionPayloads: Record<PublicTiHandoffAction, PublicTiHandoffPayload> = {
        [PUBLIC_TI_HANDOFF_ACTIONS.watchlist]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.watchlist, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.case]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.case, { orgRequired, sourceRequired, stale, missing }),
        [PUBLIC_TI_HANDOFF_ACTIONS.enrichment]: buildPublicTiHandoffPayload(result, compactArtifact, payloads, PUBLIC_TI_HANDOFF_ACTIONS.enrichment, { orgRequired, sourceRequired, stale, missing }),
    }
    return {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        recordId: artifact.id,
        query: result.query,
        orgRequired,
        sourceRequired,
        stale,
        missing,
        links: {
            watchlist: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.watchlist, PUBLIC_TI_HANDOFF_ACTIONS.watchlist, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist]),
            alertRebuild: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.alertRebuild, PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]),
            case: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.case, PUBLIC_TI_HANDOFF_ACTIONS.case, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.case]),
            enrichment: dashboardLink(PUBLIC_TI_HANDOFF_ROUTES.enrichment, PUBLIC_TI_HANDOFF_ACTIONS.enrichment, actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment]),
        },
        payload: actionPayloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist],
        payloads: actionPayloads,
    }
}

function dashboardLink(path: string, intent: PublicTiHandoffAction, payload: PublicTiHandoffPayload) {
    return {
        label: labelForHandoffAction(intent),
        href: `${path}?handoff=public-ti&intent=${encodeURIComponent(intent)}&payload=${encodeHandoffPayload(payload)}`,
        intent,
    }
}

function buildPublicTiHandoffPayload(
    result: TiSearchResponse,
    artifact: PublicTiHandoffArtifact,
    payloads: Pick<ActorArtifactHandoffs, 'watchlist' | 'alertRebuild' | 'case' | 'enrichment'>,
    action: PublicTiHandoffAction,
    bridgeState: Pick<AuthenticatedArtifactBridge, 'orgRequired' | 'sourceRequired' | 'stale' | 'missing'>
): PublicTiHandoffPayload {
    const actionPayloads = {
        watchlist: payloads.watchlist,
        alertRebuild: payloads.alertRebuild,
        case: payloads.case,
        enrichment: payloads.enrichment,
    }
    const sourceRequests = sourceRequestsFor(actionPayloads)
    return {
        schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
        source: PUBLIC_TI_HANDOFF_SOURCE,
        action,
        recordId: artifact.id,
        query: result.query,
        generatedAt: result.generatedAt,
        artifact,
        selectedPayload: selectedPayloadForAction(action, actionPayloads),
        actionPayloads,
        orgRequired: bridgeState.orgRequired,
        sourceRequired: bridgeState.sourceRequired,
        stale: bridgeState.stale,
        missing: bridgeState.missing,
        blockers: blockersForBridge(artifact, bridgeState),
        actionReadiness: actionReadinessFor(action, actionPayloads, artifact, bridgeState, sourceRequests),
        evidenceRefs: evidenceRefsFor(artifact, actionPayloads, sourceRequests),
        sourceRequests,
    }
}
