import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import { organizationWebhookDeliveryEvidenceFields } from './workflowContractFields.ts'

export function organizationSharedWatchlistWebhookDeliveryGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety'] {
    const delivery = proof.webhookBridge.deliveryContract
    const requiredIdempotencyFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredIdempotencyFields'] = [
        'eventType',
        'organizationId',
        'destinationId',
        'alert.dedupeKey',
    ]
    const requiredEvidenceFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredEvidenceFields'] = [
        ...organizationWebhookDeliveryEvidenceFields,
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['requiredRedactedFields'] = [
        'destination.endpoint',
        'destination.secret',
        'activeTerms[].term',
    ]
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrails['webhookSafety']['blockerCodes'] = []

    if (!requiredIdempotencyFields.every(field => delivery.idempotency.keyFields.includes(field))) {
        blockerCodes.push('webhook_idempotency_missing')
    }
    if (!requiredEvidenceFields.every(field => delivery.evidenceFields.includes(field))) {
        blockerCodes.push('webhook_evidence_missing')
    }
    if (!requiredRedactedFields.every(field => delivery.redactedFields.includes(field))) {
        blockerCodes.push('webhook_redaction_missing')
    }
    if (delivery.organizationId !== proof.organizationId || delivery.destinationSelection.requiredDestinationOrgId !== proof.organizationId) {
        blockerCodes.push('webhook_org_scope_missing')
    }
    if (delivery.destinationSelection.nonmemberDestinationEnumeration) {
        blockerCodes.push('webhook_destination_enumeration_enabled')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_webhook_delivery_guardrails.v1',
        ok: blockerCodes.length === 0,
        requiredIdempotencyFields,
        requiredEvidenceFields,
        requiredRedactedFields,
        destinationEnumerationAllowed: false,
        requiredDestinationOrgId: delivery.destinationSelection.requiredDestinationOrgId,
        blockerCodes,
    }
}
