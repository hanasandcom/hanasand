import { PUBLIC_TI_HANDOFF_ACTIONS, type ActorArtifact, type ActorArtifactHandoffs } from '@/utils/ti/actorWorkbench'

export function selectedArtifactPayloadFor(artifact: ActorArtifact, handoffs: ActorArtifactHandoffs) {
    const bridge = handoffs.authBridge
    const actionReadiness = Object.values(bridge.payloads).flatMap(payload => payload.actionReadiness.filter(row => row.selected))
    return {
        schemaVersion: 'ti.public_actor.selected_artifact.v1',
        artifact: bridge.payload.artifact,
        readiness: {
            state: artifact.readiness.state,
            label: artifact.readiness.label,
            blockers: artifact.readiness.blockers,
            actions: actionReadiness,
            orgRequired: bridge.orgRequired,
            sourceRequired: bridge.sourceRequired,
            stale: bridge.stale,
            missing: bridge.missing,
        },
        evidenceRefs: bridge.payload.evidenceRefs,
        sourceRequests: bridge.payload.sourceRequests,
        handoffLinks: bridge.links,
        handoffRoutes: {
            watchlist: handoffs.watchlist.backedRoute,
            alertRebuild: handoffs.alertRebuild.backedRoute,
            case: handoffs.case.backedRoute,
            enrichment: handoffs.enrichment.backedRoute,
        },
        selectedPayloads: {
            watchlist: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist].selectedPayload,
            alertRebuild: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].selectedPayload,
            case: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].selectedPayload,
            enrichment: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment].selectedPayload,
        },
    }
}
