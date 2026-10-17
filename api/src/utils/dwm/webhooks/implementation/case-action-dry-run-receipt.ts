import { dedupeFromIdempotencyKey } from '../../webhookDeliveryUtilities.ts'
import { type buildDwmWebhookDeliveryHistory } from './webhook-visibility-decision.ts'
import { type retryQueueBlocker, deliveryReceiptContext } from './retry-queue-blocker.ts'
import { buildDwmWebhookAlertSourceHandoffReadinessConsumer } from './alert-source-handoff-readiness-consumer.ts'
import { buildCaseActionConsumers } from './case-action-consumers.ts'

export function buildDwmWebhookCaseActionDryRunReceipt({
    entry,
    retryBody,
    blockers,
    canDryRunRetry,
    liveDeliveryEnabled,
}: {
    entry: ReturnType<typeof buildDwmWebhookDeliveryHistory>['entries'][number]
    retryBody: Record<string, unknown>
    blockers: ReturnType<typeof retryQueueBlocker>[]
    canDryRunRetry: boolean
    liveDeliveryEnabled: boolean
}) {
    const receiptContext = deliveryReceiptContext(entry)
    const blockingCodes = blockers.filter(blocker => blocker.blocking).map(blocker => blocker.code)
    const body = canDryRunRetry
        ? {
            ...retryBody,
            dryRun: true,
            live: false,
            replay: entry.replay,
        }
        : null
    const casePath = entry.alert.casePath || null
    const caseId = entry.alert.caseId || null
    const dedupeKey = entry.alert.dedupeKey || dedupeFromIdempotencyKey(entry.deliveryProof.idempotencyKey)
    const routeUrl = entry.alert.alertUrl || casePath || entry.route || null
    const expectedAuditAction = entry.replay ? 'delivery.replayed' : 'delivery.retry_requested'
    const sourceHandoffReadinessConsumer = buildDwmWebhookAlertSourceHandoffReadinessConsumer({
        entry,
        blockers,
        dedupeKey,
        routeUrl,
    })

    return {
        schemaVersion: 'dwm.webhook.case_action_dry_run_receipt.v1',
        noNetwork: true,
        externalSendEnabled: false,
        liveDeliveryEnabled,
        ready: canDryRunRetry,
        org: receiptContext.org,
        destination: {
            id: entry.destinationId,
            label: entry.destination.label,
            type: entry.destination.type,
            endpointHint: entry.destination.redactedEndpoint.endpointHint,
            endpointHash: entry.destination.redactedEndpoint.endpointHash,
            endpointExposed: false,
        },
        alert: receiptContext.alert,
        case: {
            id: caseId,
            path: casePath,
            alertUrl: entry.alert.alertUrl,
            routeUrl: entry.alert.alertUrl || casePath || entry.route || null,
        },
        watchlist: receiptContext.watchlist,
        provenance: receiptContext.provenance,
        workflow: {
            eventType: entry.eventType,
            status: entry.replay ? 'replayed' : entry.eventType.replace('dwm.alert.', ''),
            replay: entry.replay,
            dryRun: true,
            live: false,
            route: entry.route,
            routeUrl,
            idempotencyKey: entry.deliveryProof.idempotencyKey,
            dedupeKey,
        },
        audit: {
            auditEventId: entry.deliveryProof.auditEventId,
            currentAction: entry.deliveryProof.auditAction,
            expectedAction: expectedAuditAction,
        },
        bodyPreview: body,
        payloadPreview: entry.sanitizedPayloadPreview
            ? {
                schemaVersion: entry.sanitizedPayloadPreview.schemaVersion,
                payloadHash: entry.sanitizedPayloadPreview.payloadHash,
                discord: {
                    title: entry.discordPreview?.title || entry.alert.title || null,
                    fieldNames: entry.discordPreview?.fieldNames || [],
                    content: entry.discordPreview?.content || null,
                },
                context: {
                    alertId: entry.alert.id,
                    caseId,
                    casePath,
                    watchlistTerm: entry.watchlist.terms[0] || entry.watchlist.name || null,
                    sourceFamily: entry.alert.sourceFamily,
                    routeUrl,
                },
                redaction: {
                    safeForCustomerDisplay: true,
                    endpointExposed: false,
                    payloadExposed: false,
                },
            }
            : null,
        historyQuery: {
            method: 'GET' as const,
            route: 'GET /api/dwm/webhook-deliveries',
            query: {
                orgId: entry.orgId,
                destinationId: entry.destinationId,
                alertId: entry.alert.id,
                casePath,
                dedupeKey,
                deliveryId: entry.deliveryId,
            },
            noNetwork: true as const,
        },
        actionRequest: {
            method: 'POST' as const,
            route: 'POST /api/dwm/webhook-deliveries',
            canSend: canDryRunRetry,
            body,
            expectedAuditAction,
            blockers: canDryRunRetry ? [] : blockers.filter(blocker => blocker.blocking),
            noNetwork: true as const,
            externalSendEnabled: false as const,
        },
        ...buildCaseActionConsumers({ entry, blockers, canDryRunRetry, caseId, casePath, dedupeKey, routeUrl, expectedAuditAction }),
        sourceHandoffReadinessConsumer,
        denial: {
            denied: blockingCodes.length > 0,
            blockingCodes,
            blockers,
        },
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            secretFields: ['endpointUrl', 'endpointSecret', 'endpoint_encrypted'],
        },
    }
}
