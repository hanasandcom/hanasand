import type { buildDwmWebhookAlertDeliveryProof } from './alert-delivery-proof.ts'
import { uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { alertDeliveryProofBlocker } from './retry-queue-blocker.ts'

type ProofInput = Parameters<typeof buildDwmWebhookAlertDeliveryProof>[0]

export function buildAlertDeliveryProofBlockers({
    customerSetup,
    destinationAdminProof,
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryTimeline,
    deliveryActionPlan,
    deliveryReplayGuard,
    selectedDestinations,
}: Pick<ProofInput,
    | 'customerSetup'
    | 'destinationAdminProof'
    | 'alertDestinationReadiness'
    | 'deliveryOutcome'
    | 'deliveryTimeline'
    | 'deliveryActionPlan'
    | 'deliveryReplayGuard'
    | 'selectedDestinations'
>) {
    const setupBlockers = [
        ...customerSetup.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...destinationAdminProof.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, true)),
    ]
    const deliveryBlockers = [
        ...alertDestinationReadiness.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryOutcome.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryTimeline.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryActionPlan.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
        ...deliveryReplayGuard.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking)),
    ]
    const selectedDestinationIds = new Set(selectedDestinations.map(destination => destination.id))
    const alertScopedBlockers = uniqueWebhookBlockers(deliveryBlockers.filter((blocker) => {
        if (!blocker.destinationId) return true
        if (selectedDestinationIds.size === 0) return true
        return selectedDestinationIds.has(blocker.destinationId)
    }))
    const blockers = uniqueWebhookBlockers([...setupBlockers, ...deliveryBlockers])
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const setupBlockingCodes = uniqueWebhookBlockers(setupBlockers)
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const alertScopedBlockingCodes = alertScopedBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    const recordedDeliveryCount = deliveryOutcome.counts.recorded
    const recordedDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .map(destination => destination.destinationId)
    const pendingDestinationIds = deliveryOutcome.selectedDestinations
        .filter(destination => !destination.recorded)
        .map(destination => destination.destinationId)
    const recordedDestinationBlockers = uniqueWebhookBlockers(deliveryOutcome.selectedDestinations
        .filter(destination => destination.recorded)
        .flatMap(destination => destination.blockers.map(blocker => alertDeliveryProofBlocker(blocker.code, blocker.message, blocker.destinationId, blocker.blocking))))
    const recordedDeliveryBlockingCodes = recordedDestinationBlockers
        .filter(blocker => blocker.blocking)
        .map(blocker => blocker.code)
    return {
        setupBlockers,
        deliveryBlockers,
        selectedDestinationIds,
        alertScopedBlockers,
        blockers,
        blockingCodes,
        setupBlockingCodes,
        alertScopedBlockingCodes,
        recordedDeliveryCount,
        recordedDestinationIds,
        pendingDestinationIds,
        recordedDestinationBlockers,
        recordedDeliveryBlockingCodes,
    }
}
