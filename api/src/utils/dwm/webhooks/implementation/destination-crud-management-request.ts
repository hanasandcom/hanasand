import type { DwmAlertEventType, DwmWebhookKind, DwmWebhookStatus } from '../../webhookDestinationTypes.ts'
import { type DwmWebhookDestinationCrudAction } from './webhook-contract-types.ts'
import { type crudBlocker } from './validate-webhook-endpoint-for-contract.ts'

export function destinationCrudManagementRequest({
    action,
    orgId,
    destinationId,
    requestId,
    label,
    kind,
    channel,
    status,
    events,
    redactedEndpoint,
    blockers,
    canApply,
    liveDeliveryEnabled,
}: {
    action: DwmWebhookDestinationCrudAction
    orgId: string
    destinationId: string | null
    requestId: string
    label: string
    kind: DwmWebhookKind
    channel: string | null
    status: DwmWebhookStatus
    events: DwmAlertEventType[]
    redactedEndpoint: { endpointHint: string | null, endpointHash: string | null }
    blockers: ReturnType<typeof crudBlocker>[]
    canApply: boolean
    liveDeliveryEnabled: boolean
}) {
    const route = action === 'create'
        ? '/api/dwm/webhook-destinations'
        : action === 'test'
            ? `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}/test`
            : `/api/dwm/webhook-destinations/${destinationId || '<destination_id>'}`
    const method = action === 'create' || action === 'test'
        ? 'POST'
        : action === 'disable' || action === 'delete'
            ? 'DELETE'
            : 'PUT'
    const expectedAuditAction = action === 'create'
        ? 'destination.created'
        : action === 'disable' || action === 'delete'
            ? 'destination.archived'
            : action === 'test'
                ? 'delivery.tested'
                : 'destination.updated'
    const bodyPreview = method === 'DELETE'
        ? null
        : {
            orgId,
            destinationId,
            requestId: requestId || null,
            label,
            type: kind,
            kind,
            channel,
            status,
            events,
            dryRun: action === 'test' ? true : undefined,
            redactedEndpoint: {
                endpointHint: redactedEndpoint.endpointHint,
                endpointHash: redactedEndpoint.endpointHash,
                endpointExposed: false,
            },
            secretFields: action === 'create' || action === 'update' ? ['endpointUrl', 'webhookUrl', 'url'] : [],
        }

    return {
        schemaVersion: 'dwm.webhook.destination_management_request.v1',
        action,
        method,
        route,
        noNetwork: true,
        liveDeliveryEnabled,
        canSend: canApply,
        expectedAuditAction,
        expectedPersistedAttempt: action === 'test',
        bodyPreview,
        queryPreview: method === 'DELETE' ? { orgId, requestId: requestId || null } : null,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'webhookUrl', 'url'],
        },
        blockers,
        blockingCodes: blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code),
    }
}
