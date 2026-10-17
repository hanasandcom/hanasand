import type { DwmAlertEventType, DwmWebhookKind, DwmWebhookStatus } from '../../webhookDestinationTypes.ts'
import { redactDeliveryEvidenceText } from '../../webhookDeliveryUtilities.ts'
import { type DwmWebhookDestinationCrudAction, type DwmWebhookDestinationPublic } from './webhook-contract-types.ts'
import { type destinationCrudManagementRequest } from './destination-crud-management-request.ts'
import { type crudBlocker } from './validate-webhook-endpoint-for-contract.ts'
import { type buildDwmWebhookDestinationAdminProof } from './destination-admin-proof.ts'

export function destinationCrudPersistenceReceipt({
    action,
    orgId,
    destination,
    desired,
    managementRequest,
    blockers,
    proofRow,
    duplicateDestinationId,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destination: DwmWebhookDestinationPublic | null
    desired: {
        label: string
        type: DwmWebhookKind
        kind: DwmWebhookKind
        channel: string | null
        status: DwmWebhookStatus
        events: DwmAlertEventType[]
        redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    }
    managementRequest: ReturnType<typeof destinationCrudManagementRequest>
    blockers: ReturnType<typeof crudBlocker>[]
    proofRow: ReturnType<typeof buildDwmWebhookDestinationAdminProof>['destinations'][number] | null
    duplicateDestinationId: string | null
    liveDeliveryEnabled: boolean
}) {
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const currentStatus = destination?.status || null
    const nextStatus = action === 'delete'
        ? 'archived'
        : action === 'disable'
            ? 'paused'
            : action === 'enable'
                ? 'active'
                : desired.status
    const persisted = blockingCodes.length === 0
    const destinationId = destination?.id || null
    const redactedEndpoint = {
        endpointHint: desired.redactedEndpoint.endpointHint || (destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null),
        endpointHash: desired.redactedEndpoint.endpointHash || destination?.endpointHash || null,
        endpointExposed: false,
    }

    return {
        schemaVersion: 'dwm.webhook.destination_persistence_receipt.v1',
        action,
        org: { id: orgId },
        destinationId,
        redactedTarget: {
            destinationId,
            label: destination?.name || desired.label,
            type: destination?.kind || desired.kind,
            currentStatus,
            nextStatus,
            endpoint: redactedEndpoint,
        },
        mutation: {
            operation: action,
            persisted,
            stateChanged: Boolean(currentStatus && currentStatus !== nextStatus),
            currentStatus,
            nextStatus,
            enabledAfter: nextStatus === 'active',
            displayLabel: desired.label,
            channelLabel: desired.channel,
            events: desired.events,
        },
        request: {
            method: managementRequest.method,
            route: managementRequest.route,
            noNetwork: true,
            liveDeliveryEnabled,
            canSend: managementRequest.canSend,
            bodyPreview: managementRequest.bodyPreview,
            queryPreview: managementRequest.queryPreview,
        },
        dryRun: {
            requiredBeforeLive: true,
            testRoute: destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/<destination_id>/test',
            latestTestStatus: proofRow?.lifecycle.lastTest.status || null,
            latestTestRequestId: proofRow?.lifecycle.lastTest.requestId || null,
            latestTestAuditEventId: proofRow?.lifecycle.lastTest.auditEventId || null,
        },
        deliveryContext: {
            alertId: null,
            caseId: null,
            casePath: null,
            watchlistTerm: null,
            sourceFamily: null,
            provenanceIds: { captureIds: [], sourceIds: [], primaryCaptureId: null },
            workflowStatus: 'destination_mutation',
            routeUrl: managementRequest.route,
            appliesToAlertDelivery: false,
        },
        audit: {
            expectedAction: managementRequest.expectedAuditAction,
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateDestinationId,
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
        },
        denial: {
            denied: blockingCodes.length > 0,
            blockers,
            blockingCodes,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        noNetwork: true,
        externalSendEnabled: false,
    }
}
