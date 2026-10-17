import { buildDwmWebhookDestinationTestEvidence } from '../destinationTestEvidence.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { clean, uniqueWebhookBlockers } from '../../webhookValueUtils.ts'
import { buildIdempotencyKey, redactDeliveryEvidenceText } from '../../webhookDeliveryUtilities.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { hashValue as hashWebhookValue } from '../../webhookTransport.ts'
import { type DwmWebhookDestinationPublic, type DwmWebhookDeliveryPublic, type DwmWebhookAuditPublic, isLiveDeliveredProof } from './webhook-contract-types.ts'
import { buildDwmWebhookDestinationHealth } from './destination-health.ts'
import { testContractBlocker } from './retry-queue-blocker.ts'
import { destinationTestHealthSummary } from './destination-health.ts'

export function buildDwmWebhookDestinationTestContract({
    destination,
    deliveries = [],
    auditEvents = [],
    liveDeliveryEnabled = process.env.DWM_WEBHOOK_LIVE_DELIVERY === 'true',
    viewerRole = null,
    canManage = false,
}: {
    destination: DwmWebhookDestinationPublic | null
    deliveries?: DwmWebhookDeliveryPublic[]
    auditEvents?: DwmWebhookAuditPublic[]
    liveDeliveryEnabled?: boolean
    viewerRole?: string | null
    canManage?: boolean
}) {
    const { destinationId, latestTest, persistedLastTest, preview, testPayload, dryRunPayloadPreview } = buildDwmWebhookDestinationTestEvidence(destination, deliveries)
    const health = destination
        ? buildDwmWebhookDestinationHealth({ destinations: [destination], deliveries, auditEvents, liveDeliveryEnabled })[0] || null
        : null
    const auditContracts = buildDwmWebhookAuditEventContracts({
        auditEvents,
        deliveries,
        destinations: destination ? [destination] : [],
    })
    const latestAudit = latestTest
        ? auditContracts.find(audit => audit.deliveryId === latestTest.id) || null
        : destinationId
            ? auditContracts.find(audit => audit.destinationId === destinationId && audit.action === 'delivery.tested') || null
            : null
    const blockers: ReturnType<typeof testContractBlocker>[] = []
    if (!canManage) blockers.push(testContractBlocker('permission_denied', 'Only organization owners and admins can test webhook destinations.', destinationId))
    if (!destination) blockers.push(testContractBlocker('destination_missing', 'Webhook destination is not available for this organization.', null))
    if (destination && destination.status !== 'active') blockers.push(testContractBlocker('destination_disabled', 'Destination is disabled and cannot be tested.', destination.id))
    if (destination && !destination.endpointHash && !destination.endpointHint) blockers.push(testContractBlocker('missing_webhook_url', 'Destination has no configured webhook URL reference.', destination.id))
    if (!latestTest && !persistedLastTest) blockers.push(testContractBlocker('no_verified_dry_run', 'Destination has not recorded a dry-run test delivery yet.', destinationId, false))
    if (latestTest?.status === 'failed' || destination?.lastTestStatus === 'failed' || persistedLastTest?.status === 'failed' || health?.lastTest.status === 'failed') blockers.push(testContractBlocker('test_failed', 'Latest destination test failed.', destinationId))
    if (!latestAudit) blockers.push(testContractBlocker('audit_missing', 'Destination test has no linked audit event yet.', destinationId, false))
    if (!liveDeliveryEnabled) blockers.push(testContractBlocker('live_delivery_disabled', 'Live webhook delivery is disabled for this environment; tests default to dry-run.', destinationId, false))
    const uniqueBlockers = uniqueWebhookBlockers(blockers)
    const blockingCodes = uniqueBlockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const verified = latestTest
        ? isLiveDeliveredProof(latestTest)
        : isLiveDeliveredProof(persistedLastTest)
    const latestTestStatus = latestTest?.status || persistedLastTest?.status || null
    const expectedIdempotencyKey = destination ? buildIdempotencyKey('dwm.alert.test', destination.orgId, destination.id, 'webhook_test') : null
    const testRoute = destinationId ? `POST /api/dwm/webhook-destinations/${destinationId}/test` : 'POST /api/dwm/webhook-destinations/:id/test'
    const expectedPayloadHash = testPayload ? hashWebhookValue('payload', JSON.stringify(testPayload)) : null
    const canSendDryRunTest = Boolean(
        canManage
        && destination
        && destination.status === 'active'
        && !uniqueBlockers.some(blocker => blocker.blocking),
    )

    return {
        schemaVersion: 'dwm.webhook.destination_test.v1',
        orgId: destination?.orgId || latestTest?.orgId || null,
        destinationId,
        type: destination?.kind || null,
        label: destination?.name || null,
        status: verified ? 'verified' : latestTestStatus === 'failed' || destination?.lastTestStatus === 'failed' || health?.lastTest.status === 'failed' ? 'test_failed' : destination?.status === 'archived' || destination?.status === 'paused' ? 'disabled' : 'pending',
        noNetwork: true,
        liveDeliveryEnabled,
        externalSendEnabled: false,
        access: {
            role: clean(viewerRole) || null,
            canTest: Boolean(canManage && destination && destination.status === 'active' && blockingCodes.length === 0),
            canReadStatus: Boolean(destination || latestTest),
            memberSafe: !canManage,
        },
        redactedEndpoint: {
            endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : preview?.destination.endpointHint || null,
            endpointHash: destination?.endpointHash || preview?.destination.endpointHash || null,
        },
        latestTest: latestTest
            ? {
                requestId: latestTest.id,
                deliveryId: latestTest.id,
                status: latestTest.status,
                dryRun: latestTest.dryRun,
                live: !latestTest.dryRun && latestTest.status !== 'skipped',
                responseStatus: latestTest.responseStatus,
                error: latestTest.error ? redactDeliveryEvidenceText(latestTest.error) : null,
                attemptedAt: latestTest.attemptedAt,
                payloadHash: latestTest.payloadHash,
                idempotencyKey: latestTest.idempotencyKey,
                source: 'delivery_ledger',
            }
            : persistedLastTest,
        preview: preview
            ? {
                discord: {
                    content: preview.discord.content,
                    embedCount: Array.isArray(preview.discord.embeds) ? preview.discord.embeds.length : 0,
                    fieldNames: Array.isArray((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields)
                        ? (((preview.discord.embeds as Array<Record<string, unknown>>)[0]?.fields || []) as Array<Record<string, unknown>>).map(field => clean(field.name)).filter(Boolean)
                        : [],
                    allowedMentions: preview.discord.allowedMentions,
                },
                context: preview.context,
                payloadHash: preview.payloadHash,
            }
            : null,
        dryRunPayloadPreview,
        dryRunTestReceipt: {
            schemaVersion: 'dwm.webhook.destination_test_receipt.v1',
            noNetwork: true,
            externalSendEnabled: false,
            destinationId,
            orgId: destination?.orgId || null,
            status: 'dry_run',
            dryRun: true,
            live: false,
            eventType: 'dwm.alert.test' as DwmAlertEventType,
            idempotencyKey: expectedIdempotencyKey,
            payloadHash: expectedPayloadHash,
            redactedDestination: {
                id: destinationId,
                label: destination?.name || null,
                type: destination?.kind || null,
                endpointHint: destination?.endpointHint ? redactDeliveryEvidenceText(destination.endpointHint) : null,
                endpointHash: destination?.endpointHash || null,
                endpointExposed: false,
            },
            expected: {
                deliveryStatus: 'dry_run',
                auditAction: 'delivery.tested',
                persistedAttempt: true,
                responseSummary: 'Dry-run delivery payload prepared without external network.',
            },
            retry: {
                attemptCount: 1,
                retryable: false,
                nextRetryAt: null,
                errorClass: null,
            },
            timestamps: {
                attemptedAt: null,
                createdAt: null,
                updatedAt: null,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
        dryRunTestRequest: {
            method: 'POST',
            route: testRoute,
            canSend: canSendDryRunTest,
            noNetwork: true,
            externalSendEnabled: false,
            body: destination
                ? {
                    orgId: destination.orgId,
                    destinationId: destination.id,
                    eventType: 'dwm.alert.test' as DwmAlertEventType,
                    dryRun: true,
                    live: false,
                    idempotencyKey: expectedIdempotencyKey,
                }
                : null,
            expected: {
                deliveryStatus: 'dry_run',
                persistedAttempt: true,
                auditAction: 'delivery.tested',
                idempotencyKey: expectedIdempotencyKey,
                endpointExposed: false,
            },
            payloadPreview: dryRunPayloadPreview,
            blockers: uniqueBlockers,
        },
        health: destinationTestHealthSummary(health),
        audit: {
            latestAuditEventId: latestAudit?.auditEventId || null,
            auditEventIds: auditContracts.filter(audit => audit.destinationId === destinationId).map(audit => audit.auditEventId),
            auditEventContracts: canManage ? auditContracts.filter(audit => audit.destinationId === destinationId).slice(0, 10) : [],
        },
        blockers: uniqueBlockers,
        blockingCodes,
        routes: {
            test: testRoute,
            destination: destinationId ? `GET /api/dwm/webhooks?destinationId=${destinationId}` : 'GET /api/dwm/webhooks',
        },
    }
}
