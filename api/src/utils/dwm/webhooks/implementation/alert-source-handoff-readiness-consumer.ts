import { buildWebhookDestinationReadinessBridge } from '../../../webhookDestinationReadinessBridge.ts'
import { type buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'
import { type retryQueueBlocker, deliveryReceiptContext } from './retry-queue-blocker.ts'

export function buildDwmWebhookAlertSourceHandoffReadinessConsumer({
    entry,
    blockers,
    dedupeKey,
    routeUrl,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    blockers: ReturnType<typeof retryQueueBlocker>[]
    dedupeKey: string | null
    routeUrl: string | null
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const captureIds = entry.alert.provenanceIds.captureIds || []
    const sourceIds = entry.alert.provenanceIds.sourceIds || []
    const sourceReady = Boolean(entry.alert.sourceFamily && entry.alert.evidenceCount > 0 && captureIds.length > 0 && sourceIds.length > 0)
    const destinationReady = Boolean(entry.destinationId && entry.destination.enabled !== false && entry.destination.status !== 'disabled')
    const deliveryReady = destinationReady && !blockers.some(blocker => blocker.blocking && ['destination_unavailable', 'destination_disabled', 'permission_denied'].includes(blocker.code))
    const state = sourceReady && deliveryReady
        ? 'ready_for_consumers'
        : !sourceReady
            ? 'source_provenance_gap'
            : 'delivery_handoff_gap'

    return {
        schemaVersion: 'dwm.webhook.alert_source_handoff_readiness_consumer.v1',
        consumesSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
        noNetwork: true,
        ready: state === 'ready_for_consumers',
        state,
        routeContract: {
            sourceHandoff: {
                method: 'GET' as const,
                route: '/v1/dwm/alerts',
                requiredQuery: ['organizationId', 'alertId'],
                expectedSchemaVersion: 'dwm.alert_source_handoff_readiness.v1',
                noNetwork: true,
            },
        },
        org: receiptContext.org,
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: {
            ...receiptContext.alert,
            selectedCaptureIds: captureIds,
            provenanceCaptureIds: captureIds,
            provenanceSourceIds: sourceIds,
            provenanceGapCodes: sourceReady ? [] : ['missing_source_provenance'],
        },
        case: {
            id: entry.alert.caseId || null,
            path: entry.alert.casePath || null,
            routeUrl,
        },
        watchlist: receiptContext.watchlist,
        webhookConsumer: {
            ready: deliveryReady,
            deliveryReady,
            delivered: entry.dedupe.alreadyDelivered || entry.status === 'sent',
            deliveryDedupeKey: dedupeKey,
            deliveryHistoryRefs: [entry.deliveryId].filter(Boolean),
            blockerCodes: blockers.map(blocker => blocker.code),
            retry: {
                retryable: entry.retry.retryable,
                nextRetryAt: entry.retry.nextRetryAt,
                attemptCount: entry.retry.attemptCount,
                terminalFailure: entry.retry.terminalFailure,
            },
        },
        caseConsumer: {
            ready: Boolean(entry.alert.caseId || entry.alert.casePath),
            caseId: entry.alert.caseId || null,
            casePath: entry.alert.casePath || null,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            blockerCodes: [],
        },
        orgDestinationReadinessBridge: buildWebhookDestinationReadinessBridge({
            defaultWebhookPolicy: 'manual_selection',
            canUseDefaultDestinations: false,
            selectedDestinationSource: entry.destinationId ? 'manual_selection' : 'manual_selection_required',
            requiredDestinationOrgId: entry.orgId,
            blockerCodes: blockers.map(blocker => blocker.code),
            dwmReadiness: {
                ready: deliveryReady,
                selectedDestination: entry.destinationId
                    ? {
                        id: entry.destinationId,
                        orgId: entry.orgId,
                        label: entry.destination.label,
                        type: entry.destination.type,
                        endpointHash: entry.destination.redactedEndpoint.endpointHash,
                        endpointExposed: false,
                        status: entry.destination.status,
                        enabled: entry.destination.enabled,
                    }
                    : null,
                retry: {
                    retryable: entry.retry.retryable,
                    nextRetryAt: entry.retry.nextRetryAt,
                    attemptCount: entry.retry.attemptCount,
                    terminalFailure: entry.retry.terminalFailure,
                },
                idempotency: {
                    key: entry.deliveryProof.idempotencyKey,
                    dedupeKey,
                },
            },
        }),
        stableFields: [
            'sourceFamily',
            'selectedCaptureIds',
            'evidenceCount',
            'provenanceCaptureIds',
            'provenanceSourceIds',
            'webhookConsumer.deliveryDedupeKey',
            'webhookConsumer.retry.nextRetryAt',
            'caseConsumer.casePath',
            'orgDestinationReadinessBridge.selectedDestination.id',
        ],
        gapFields: [
            'state',
            'alert.provenanceGapCodes',
            'webhookConsumer.blockerCodes',
            'orgDestinationReadinessBridge.blockerCodes',
        ],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
        },
    }
}
