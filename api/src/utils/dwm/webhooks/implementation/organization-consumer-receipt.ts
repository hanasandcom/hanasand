import type { DwmAlertWebhookDispatchPlan } from '../dispatchPlanning.ts'
import type { DwmAlertEventType } from '../../webhookDestinationTypes.ts'
import { clean } from '../../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../../webhookAlertNormalization.ts'
import { buildDwmWebhookAuditEventContracts } from '../../webhookAuditContracts.ts'
import { type buildDwmAlertWebhookReadinessHandoff } from './alert-readiness-handoff.ts'
import { type buildDwmOrgAlertWebhookDeliveryOutcome } from './org-alert-delivery-outcome.ts'
import { type buildDwmWebhookDeliveryReadinessConsumerProof } from './delivery-history-consumer-proof.ts'
import { type buildDwmWebhookAlertDeliveryProof } from './alert-delivery-proof.ts'
import { buildOrganizationDestinationReceipts } from './organization-destination-receipts.ts'

export function buildDwmWebhookOrganizationConsumerReceipt({
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
    alertDestinationReadiness,
    deliveryOutcome,
    deliveryReadinessConsumer,
    alertDeliveryProof,
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
    alertDestinationReadiness: ReturnType<typeof buildDwmAlertWebhookReadinessHandoff>
    deliveryOutcome: ReturnType<typeof buildDwmOrgAlertWebhookDeliveryOutcome>
    deliveryReadinessConsumer: ReturnType<typeof buildDwmWebhookDeliveryReadinessConsumerProof>
    alertDeliveryProof: ReturnType<typeof buildDwmWebhookAlertDeliveryProof>
    auditEventContracts: ReturnType<typeof buildDwmWebhookAuditEventContracts>
}) {
    const idempotencySeed = normalizedAlert.dedupeKey || normalizedAlert.id
    const selectedBlockingCodes = alertDeliveryProof.alertScopedBlockerCodes
    const skippedBlockerCodes = skippedDestinations.map((destination) => {
        if (destination.reason === 'disabled') return 'destination_disabled'
        if (destination.reason === 'org_mismatch') return 'org_mismatch'
        return destination.reason
    })
    const blockerCodes = [...new Set([
        ...selectedBlockingCodes,
        ...skippedBlockerCodes,
        ...(!orgId ? ['missing_org_ref'] : []),
        ...(selectedDestinations.length === 0 ? ['destination_unavailable'] : []),
        ...(!liveDeliveryEnabled && liveRequested && !dryRun ? ['live_delivery_disabled'] : []),
    ])]
    const destinationDeliveryReady = selectedDestinations.length > 0 && Boolean(orgId)
    const readyForDelivery = destinationDeliveryReady && selectedBlockingCodes.length === 0
    const dryRunReady = destinationDeliveryReady && (dryRun || !liveRequested || !liveDeliveryEnabled)
    const watchedTerms = (watchlist.terms.length ? watchlist.terms : [watchlist.name || watchlist.id])
        .map(term => clean(term))
        .filter(Boolean)

    return {
        schemaVersion: 'dwm.webhook.organization_delivery_consumer_receipt.v1',
        consumesSchemaVersion: 'organization.webhook_destination_delivery_consumer.v1',
        ownerId,
        organizationId: orgId,
        tenantId: orgId,
        route: 'POST /api/dwm/webhook-deliveries',
        upstreamRoute: 'POST /v1/dwm/webhooks/deliver',
        eventType,
        readyForDelivery,
        destinationDeliveryReady,
        dryRunReady,
        blockerReason: blockerCodes[0] || null,
        liveRequested,
        liveDeliveryEnabled,
        noNetwork: dryRun || !liveRequested || !liveDeliveryEnabled,
        externalSendEnabled: liveRequested && !dryRun && liveDeliveryEnabled && readyForDelivery,
        roleGates: {
            automaticDelivery: ['owner', 'admin'],
            manualTrigger: ['owner', 'admin'],
            readDeliverySummary: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
        },
        destinationScope: {
            selectedDestinationOrgField: 'destination.org_id',
            selectedDestinationIdField: 'webhookDestinationIds[]',
            crossOrgDestinationAllowed: false,
            nonmemberDestinationEnumeration: false,
        },
        alertContext: {
            alertId: normalizedAlert.id,
            title: normalizedAlert.title,
            severity: normalizedAlert.severity,
            confidence: normalizedAlert.confidence,
            sourceFamily: normalizedAlert.sourceFamily,
            route: normalizedAlert.route,
            alertUrl: normalizedAlert.alertUrl,
            caseId: normalizedAlert.caseId,
            casePath: normalizedAlert.casePath,
            evidenceCount: normalizedAlert.evidenceCount,
            provenanceSummary: normalizedAlert.provenanceSummary,
            dedupeKey: normalizedAlert.dedupeKey,
        },
        watchlistMatches: watchedTerms.map((term) => ({
            organizationId: orgId,
            tenantId: orgId,
            watchlistId: watchlist.id,
            watchlistItemId: watchlist.id,
            watchedEntity: {
                type: 'domain',
                value: term,
                normalizedValue: term.toLowerCase(),
            },
            matchReason: {
                kind: 'shared_watchlist_term',
                code: 'organization_watchlist_term_match',
            },
            actorRef: {
                userId: ownerId,
                role: 'admin',
                source: 'webhook_delivery_contract',
            },
            sourceRefs: {
                sourceFamily: normalizedAlert.sourceFamily,
                exportRoute: 'GET /api/organizations/:id/watchlists/alert-terms',
                caseVisibilityRoute: 'GET /api/organizations/:id/alert-case-visibility',
                deliveryRoute: 'POST /api/dwm/webhook-deliveries',
            },
            provenanceHash: normalizedAlert.provenanceSummary || normalizedAlert.dedupeKey || normalizedAlert.id,
            workflowStatus: readyForDelivery ? 'ready_for_delivery' : 'blocked',
            destinationReadiness: {
                destinationDeliveryReady: readyForDelivery,
                dryRunReady,
                selectedDestinationOrgField: 'destination.org_id',
                selectedDestinationIdField: 'webhookDestinationIds[]',
                blockerReason: blockerCodes[0] || null,
            },
        })),
        destinationReceipts: buildOrganizationDestinationReceipts({
            eventType,
            orgId,
            liveDeliveryEnabled,
            selectedDestinations,
            deliveryReadinessConsumer,
            deliveryOutcome,
            idempotencySeed,
        }),
        skippedDestinations: skippedDestinations.map(destination => ({
            destinationId: destination.id,
            orgId: destination.orgId,
            status: destination.status,
            reason: destination.reason,
            code: destination.reason === 'disabled' ? 'destination_disabled' : destination.reason,
        })),
        lifecycleBlockers: blockerCodes.filter(code => [
            'org_archived',
            'org_deleted',
            'member_revoked',
            'watchlist_paused',
            'watchlist_archived',
            'manual_webhook_selection_required',
            'role_not_allowed',
            'destination_disabled',
            'destination_unavailable',
            'missing_org_ref',
            'live_delivery_disabled',
        ].includes(code)),
        blockerCodes,
        audit: {
            auditEventIds: [...new Set(auditEventContracts.map(audit => audit.auditEventId).filter(Boolean))],
            linked: auditEventContracts.length > 0,
            expectedActions: [...new Set(auditEventContracts.map(audit => audit.action).filter(Boolean))],
        },
        readiness: {
            alertDestinationReady: alertDestinationReadiness.ready,
            deliveryReadinessStatus: alertDeliveryProof.alertScopedStatus,
            recordedDeliveryStatus: alertDeliveryProof.delivery.recordedDeliveryStatus,
            retryableFailureCount: deliveryReadinessConsumer.counts.retryableFailure,
            nonRetryableFailureCount: deliveryReadinessConsumer.counts.nonRetryableFailure,
            idempotentReplayCount: deliveryReadinessConsumer.counts.idempotentReplay,
            redactedDryRunCount: deliveryReadinessConsumer.counts.redactedDryRun,
        },
        noLeakFields: ['destination.secret', 'destination.endpoint', 'otherOrg.destinationIds', 'case.evidence.rawContent'],
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            responseBodyExposed: false,
            webhookSecretExposed: false,
            payloadSecretExposed: false,
        },
    }
}
