import type { DwmWebhookDestinationInput, DwmWebhookKind } from '../../webhookDestinationTypes.ts'
import { clean, firstClean } from '../../webhookValueUtils.ts'
import { parseEvents, parseKind, parseStatus, redactWebhookEndpoint, WEBHOOK_KINDS } from '../../webhookDestinationInput.ts'
import { redactDeliveryEvidenceText } from '../../webhookDeliveryUtilities.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import { type DwmWebhookDestinationCrudAction, type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic } from './webhook-contract-types.ts'
import { validateWebhookEndpointForContract, destinationCrudRouteContract } from './validate-webhook-endpoint-for-contract.ts'
import { buildDwmWebhookDestinationAdminProof } from './destination-admin-proof.ts'
import { destinationCrudManagementRequest } from './destination-crud-management-request.ts'
import { destinationCrudPersistenceReceipt } from './destination-crud-persistence-receipt.ts'
import { buildDestinationCrudBlockers } from './destination-crud-blockers.ts'

export function buildDwmWebhookDestinationCrudContract({
    action,
    ownerId,
    input = {},
    destination = null,
    destinations = [],
    deliveries = [],
    auditEvents = [],
    viewerRole = null,
    canManage = false,
    entitlementAllowed = true,
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
}: {
    action: DwmWebhookDestinationCrudAction
    ownerId: string
    input?: DwmWebhookDestinationInput
    destination?: DwmWebhookDestinationPublic | null
    destinations?: DwmWebhookDestinationPublic[]
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    viewerRole?: string | null
    canManage?: boolean
    entitlementAllowed?: boolean
    liveDeliveryEnabled?: boolean
}) {
    const requestId = firstClean(input.requestId, input.request_id)
    const rawEndpoint = firstClean(input.endpointUrl, input.endpoint_url, input.webhookUrl, input.webhook_url, input.url)
    const rawKind = firstClean(input.kind, input.type)
    const endpointValidation = validateWebhookEndpointForContract(rawEndpoint)
    const normalizedKind = WEBHOOK_KINDS.has(rawKind as DwmWebhookKind)
        ? rawKind as DwmWebhookKind
        : endpointValidation.normalizedUrl
            ? parseKind(rawKind, endpointValidation.normalizedUrl, destination?.kind)
            : destination?.kind || 'webhook'
    const normalizedEndpointHash = endpointValidation.normalizedUrl ? hashWebhookValue('endpoint', endpointValidation.normalizedUrl) : destination?.endpointHash || null
    const normalizedEndpointHint = endpointValidation.normalizedUrl ? redactWebhookEndpoint(endpointValidation.normalizedUrl) : destination?.endpointHint || null
    const normalizedOrgId = firstClean(input.orgId, destination?.orgId, ownerId)
    const normalizedLabel = firstClean(input.name, input.label, input.channelName, input.channel_name, input.channel, destination?.name)
        || (normalizedKind === 'discord' ? 'Discord alerts' : 'Webhook alerts')
    const operationStatus = action === 'delete' ? 'archived' : action === 'disable' ? 'paused' : null
    const status = parseStatus(input.status ?? operationStatus ?? destination?.status ?? 'active')
    const scopedDestinations = destinations.filter(item => item.orgId === normalizedOrgId)
    const duplicate = normalizedEndpointHash
        ? scopedDestinations.find(item => item.endpointHash === normalizedEndpointHash && item.id !== destination?.id && item.status !== 'archived') || null
        : null
    const adminProof = buildDwmWebhookDestinationAdminProof({
        destinations: destination ? [destination] : scopedDestinations,
        deliveries,
        auditEvents,
        liveDeliveryEnabled,
        viewerRole,
        canManage,
    })
    const proofRow = destination ? adminProof.destinations.find(item => item.destinationId === destination.id) || null : null
    const { uniqueBlockers, blocking } = buildDestinationCrudBlockers({
        action,
        input,
        destination,
        rawKind,
        endpointValidation,
        normalizedOrgId,
        rawEndpoint,
        duplicate,
        canManage,
        entitlementAllowed,
        proofRow,
    })
    const redactedEndpoint = () => ({ endpointHint: normalizedEndpointHint, endpointHash: normalizedEndpointHash })
    const routeContract = destinationCrudRouteContract()
    const managementRequest = destinationCrudManagementRequest({
        action,
        orgId: normalizedOrgId,
        destinationId: destination?.id || null,
        requestId,
        label: normalizedLabel.slice(0, 120),
        kind: normalizedKind,
        channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
        status,
        events: parseEvents(input.events),
        redactedEndpoint: redactedEndpoint(),
        blockers: uniqueBlockers,
        canApply: blocking.length === 0,
        liveDeliveryEnabled,
    })
    const destinationPersistenceReceipt = destinationCrudPersistenceReceipt({
        action,
        orgId: normalizedOrgId,
        destination,
        desired: {
            label: normalizedLabel.slice(0, 120),
            type: normalizedKind,
            kind: normalizedKind,
            channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
            status,
            events: parseEvents(input.events),
            redactedEndpoint: redactedEndpoint(),
        },
        managementRequest,
        blockers: uniqueBlockers,
        proofRow,
        duplicateDestinationId: duplicate?.id || null,
        liveDeliveryEnabled,
    })
    return {
        schemaVersion: 'dwm.webhook.destination_crud.v1',
        action,
        requestId: requestId || null,
        ownerId,
        orgId: normalizedOrgId,
        canApply: blocking.length === 0,
        access: {
            role: clean(viewerRole) || null,
            canManage,
            canCreate: canManage,
            canUpdate: canManage && Boolean(destination),
            canDisable: canManage && destination?.status === 'active',
            canDelete: canManage && destination?.status === 'active',
            canEnable: canManage && Boolean(destination) && destination?.status !== 'active',
            canTest: canManage && Boolean(destination),
            memberSafe: !canManage,
        },
        desired: {
            label: normalizedLabel.slice(0, 120),
            type: normalizedKind,
            kind: normalizedKind,
            channel: firstClean(input.channelName, input.channel_name, input.channel) || null,
            status,
            events: parseEvents(input.events),
            redactedEndpoint: redactedEndpoint(),
        },
        destination: destination
            ? {
                id: destination.id,
                orgId: destination.orgId,
                label: destination.name,
                type: destination.kind,
                status: destination.status,
                enabled: destination.status === 'active',
                redactedEndpoint: {
                    endpointHint: redactDeliveryEvidenceText(destination.endpointHint),
                    endpointHash: destination.endpointHash,
                },
            }
            : null,
        duplicateDestinationId: duplicate?.id || null,
        blockers: uniqueBlockers,
        blockingCodes: blocking.map(blocker => blocker.code),
        health: proofRow
            ? {
                status: proofRow.health.status,
                ready: proofRow.health.ready,
                blockers: proofRow.health.adminProofBlockers,
                retry: proofRow.retry,
                audit: proofRow.audit,
                productProgress: adminProof.productProgress,
            }
            : {
                status: 'pending',
                ready: false,
                blockers: [],
                retry: null,
                audit: null,
                productProgress: adminProof.productProgress,
            },
        audit: {
            latestAuditEventId: proofRow?.audit.latestAuditEventId || null,
            auditEventIds: proofRow?.audit.auditEventIds || [],
        },
        idempotency: {
            duplicateKeyCount: proofRow?.dedupe.duplicateKeyCount || 0,
            alreadyDelivered: proofRow?.dedupe.alreadyDelivered || false,
            latestDedupeKey: proofRow?.dedupe.latestDedupeKey || null,
            duplicateDestinationId: duplicate?.id || null,
        },
        routeContract,
        managementRequest,
        destinationPersistenceReceipt,
        noNetwork: true,
        liveDeliveryEnabled,
    }
}
