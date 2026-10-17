import type { DwmAlertWebhookDispatchPlan } from '../dispatchPlanning.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { type buildDwmWebhookCustomerSetupProof } from './customer-setup-proof.ts'
import { type buildDwmAlertWebhookReadinessHandoff } from './alert-readiness-handoff.ts'
import { type buildDwmOrgAlertWebhookDeliveryOutcome } from './org-alert-delivery-outcome.ts'
import { type buildDwmWebhookDeliveryTimeline } from './delivery-read-projections.ts'
import { type buildDwmWebhookDeliveryActionPlan } from './delivery-action-plan.ts'
import { type buildDwmWebhookDeliveryReplayGuard } from './delivery-replay-guard.ts'
import { type buildDwmWebhookDestinationAdminProof } from './destination-admin-proof.ts'
import { buildAlertDeliveryProofRequests } from './alert-delivery-proof-requests.ts'
import { buildAlertDeliveryProofBlockers } from './alert-delivery-proof-blockers.ts'
import { buildAlertDeliveryProofStatuses } from './alert-delivery-proof-status.ts'

export function buildDwmWebhookAlertDeliveryProof({
    ownerId,
    orgId,
    eventType,
    dryRun,
    liveRequested,
    liveDeliveryEnabled,
    selectedDestinations,
    skippedDestinations,
    normalizedAlert,
    watchlist,
    customerSetup,
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryTimeline,
    deliveryActionPlan,
    deliveryReplayGuard,
    destinationAdminProof,
    auditEventContracts,
}: {
    ownerId: string
    orgId: string
    eventType: DwmAlertEventType
    dryRun: boolean
    liveRequested: boolean
    liveDeliveryEnabled: boolean
    selectedDestinations: DwmAlertWebhookDispatchPlan['selectedDestinations']
    skippedDestinations: DwmAlertWebhookDispatchPlan['skippedDestinations']
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    customerSetup: ReturnType<typeof buildDwmWebhookCustomerSetupProof>
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryTimeline: ReturnType<typeof buildDwmWebhookDeliveryTimeline>
    deliveryActionPlan: ReturnType<typeof buildDwmWebhookDeliveryActionPlan>
    deliveryReplayGuard: ReturnType<typeof buildDwmWebhookDeliveryReplayGuard>
    destinationAdminProof: ReturnType<typeof buildDwmWebhookDestinationAdminProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const {
        selectedDestinationIds,
        alertScopedBlockers,
        blockers,
        blockingCodes,
        setupBlockingCodes,
        alertScopedBlockingCodes,
        recordedDeliveryCount,
        recordedDestinationIds,
        pendingDestinationIds,
        recordedDeliveryBlockingCodes,
    } = buildAlertDeliveryProofBlockers({
        customerSetup,
        destinationAdminProof,
        alertDestinationReadiness,
        deliveryOutcome,
        deliveryTimeline,
        deliveryActionPlan,
        deliveryReplayGuard,
        selectedDestinations,
    })
    const auditEventIds = [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))]
    const { status, alertScopedStatus } = buildAlertDeliveryProofStatuses({
        customerSetup,
        alertDestinationReadiness,
        recordedDeliveryCount,
        blockingCodes,
        alertScopedBlockingCodes,
    })

    return {
        schemaVersion: 'dwm.webhook.alert_delivery_proof.v1',
        ownerId,
        orgId: orgId || null,
        alertId: normalizedAlert.id,
        eventType,
        status,
        alertScopedStatus,
        dryRun,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled,
        alert: {
            id: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            evidenceCount: normalizedAlert.evidenceCount,
            route: normalizedAlert.route,
            dedupeKey: normalizedAlert.dedupeKey,
            casePath: normalizedAlert.casePath,
            caseId: normalizedAlert.caseId,
            alertUrl: normalizedAlert.alertUrl,
            provenanceSummary: normalizedAlert.provenanceSummary,
        },
        watchlist,
        destinationSelection: {
            selectedCount: selectedDestinations.length,
            skippedCount: skippedDestinations.length,
            selectedDestinationIds: [...selectedDestinationIds],
            skippedDestinations: skippedDestinations.map(destination => ({
                id: destination.id,
                orgId: destination.orgId,
                reason: destination.reason,
                blocking: destination.reason !== 'event_not_subscribed',
            })),
        },
        setup: {
            status: customerSetup.status,
            summary: customerSetup.summary,
            routeNames: customerSetup.routes,
            stepStatuses: customerSetup.setupSteps.map(step => ({
                id: step.id,
                status: step.status,
                route: step.route,
                blockerCodes: step.blockers.map(blocker => blocker.code),
            })),
        },
        delivery: {
            ready: alertDestinationReadiness.ready,
            state: alertDestinationReadiness.state,
            outcomeCounts: deliveryOutcome.counts,
            timelineCounts: deliveryTimeline.counts,
            actionCounts: deliveryActionPlan.counts,
            replayGuardCounts: deliveryReplayGuard.counts,
            latestAuditEventIds: auditEventIds.slice(0, 10),
            recordedDestinationIds,
            pendingDestinationIds,
            recordedDeliveryStatus: recordedDeliveryCount === 0
                ? 'not_recorded'
                : recordedDeliveryBlockingCodes.length > 0
                    ? 'blocked'
                    : 'recorded',
            recordedDeliveryBlockerCodes: recordedDeliveryBlockingCodes,
        },
        retryAndReplay: {
            retryScheduledCount: deliveryActionPlan.counts.retryDryRun + deliveryActionPlan.counts.retryLive,
            replayReadyCount: deliveryReplayGuard.counts.dryRunAllowed,
            duplicateDeliveredCount: deliveryReplayGuard.counts.duplicateDelivered,
            terminalFailureCount: deliveryReplayGuard.counts.terminalFailure,
        },
        dashboardProof: {
            productProgress: destinationAdminProof.productProgress,
            adminProofSummary: destinationAdminProof.summary,
            customerSetupRoute: customerSetup.routes.list,
            deliveryRoute: customerSetup.routes.deliver,
            deliveryHistoryRoute: customerSetup.routes.deliveryHistory,
        },
        actionRequests: buildAlertDeliveryProofRequests({
            orgId,
            eventType,
            dryRun,
            liveRequested,
            liveDeliveryEnabled,
            selectedDestinations,
            normalizedAlert,
            watchlist,
            customerSetup,
            alertDestinationReadiness,
            auditEventContracts,
            alertScopedBlockers,
            selectedDestinationIds,
        }),
        blockers,
        blockerCodes: blockingCodes,
        alertScopedBlockers,
        alertScopedBlockerCodes: alertScopedBlockingCodes,
        blockerGroups: {
            setupBlockerCodes: setupBlockingCodes,
            alertScopedBlockerCodes: alertScopedBlockingCodes,
            allBlockerCodes: blockingCodes,
        },
    }
}
