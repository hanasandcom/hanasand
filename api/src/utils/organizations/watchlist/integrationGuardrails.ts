import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationSharedWatchlistIntegrationGuardrailCode, OrganizationSharedWatchlistIntegrationGuardrails } from '../contracts/integrationGuardrails.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationSharedWatchlistAlertQueueVisibility } from './alertQueueVisibility.ts'
import { organizationSharedWatchlistWebhookDeliveryGuardrails } from './webhookDeliveryGuardrails.ts'
import { organizationSharedWatchlistCaseWorkflowGuardrails } from './caseWorkflowGuardrails.ts'

export function organizationSharedWatchlistIntegrationGuardrails(
    proof: OrganizationSharedWatchlistDownstreamProof
): OrganizationSharedWatchlistIntegrationGuardrails {
    const blockerCodes: OrganizationSharedWatchlistIntegrationGuardrailCode[] = []
    const requiredPayloadShape = [
        'alertBridge.persistenceContract.persistedAlertFields',
        'alertBridge.persistenceContract.workflowContextFields',
        'alertBridge.queueVisibilityContract.actorVisibility',
        'alertBridge.queueVisibilityContract.watchlistScope',
        'caseBridge.caseWorkflowContract.actorActions',
        'caseBridge.caseWorkflowContract.watchlistScope',
        'webhookBridge.deliveryContract.destinationSelection',
        'webhookBridge.deliveryContract.idempotency',
        'monitoringWorkflow',
        'analystPortalWorkflow',
        'enrichmentProvenance',
        'audit.eventActions',
        'audit.eventBridge',
        'audit.requiredMetadataFields',
    ]
    const watchlistIds = [...proof.watchlistOwnership.activeIds].sort()
    const persistenceWatchlistIds = [...proof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds].sort()
    const alertWatchlistIds = [...proof.alertBridge.queueVisibilityContract.watchlistScope.watchlistItemIds].sort()
    const caseWatchlistIds = [...proof.caseBridge.caseWorkflowContract.watchlistScope.watchlistItemIds].sort()
    const alertGeneratorKeys = [...proof.alertBridge.alertGeneratorKeys].sort()
    const persistenceContractKeys = [...proof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys].sort()
    const alertContractKeys = [...proof.alertBridge.queueVisibilityContract.watchlistScope.alertGeneratorKeys].sort()
    const caseContractKeys = [...proof.caseBridge.caseWorkflowContract.watchlistScope.alertGeneratorKeys].sort()
    const alertQueueVisibility = organizationSharedWatchlistAlertQueueVisibility(proof)
    const webhookSafety = organizationSharedWatchlistWebhookDeliveryGuardrails(proof)
    const caseSafety = organizationSharedWatchlistCaseWorkflowGuardrails(proof)

    if (proof.schemaVersion !== 'organization.shared_watchlist_downstream_proof.v1') blockerCodes.push('schema_mismatch')
    if (proof.audit.schemaVersion !== 'organization.shared_watchlist_audit_contract.v1') blockerCodes.push('schema_mismatch')
    if (proof.alertBridge.persistenceContract.schemaVersion !== 'organization.watchlist_alert_persistence_contract.v1') blockerCodes.push('alert_contract_missing')
    if (proof.alertBridge.queueVisibilityContract.schemaVersion !== 'organization.watchlist_alert_visibility_contract.v1') blockerCodes.push('alert_contract_missing')
    if (proof.caseBridge.caseWorkflowContract.schemaVersion !== 'organization.watchlist_case_workflow_contract.v1') blockerCodes.push('case_contract_missing')
    if (proof.webhookBridge.deliveryContract.schemaVersion !== 'organization.watchlist_webhook_delivery_contract.v1') blockerCodes.push('webhook_contract_missing')

    if (
        proof.ownerOrganizationId !== proof.organizationId
        || proof.tenantId !== proof.organizationId
        || proof.alertBridge.persistenceContract.organizationId !== proof.organizationId
        || proof.alertBridge.persistenceContract.tenantId !== proof.organizationId
        || proof.alertBridge.queueVisibilityContract.organizationId !== proof.organizationId
        || proof.alertBridge.queueVisibilityContract.tenantId !== proof.organizationId
        || proof.caseBridge.caseWorkflowContract.organizationId !== proof.organizationId
        || proof.caseBridge.caseWorkflowContract.tenantId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.organizationId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.tenantId !== proof.organizationId
        || proof.webhookBridge.deliveryContract.destinationSelection.requiredDestinationOrgId !== proof.organizationId
    ) {
        blockerCodes.push('org_scope_mismatch')
    }

    if (
        !sameStringSet(watchlistIds, persistenceWatchlistIds)
        || !sameStringSet(watchlistIds, alertWatchlistIds)
        || !sameStringSet(watchlistIds, caseWatchlistIds)
        || !sameStringSet(alertGeneratorKeys, persistenceContractKeys)
        || !sameStringSet(alertGeneratorKeys, alertContractKeys)
        || !sameStringSet(alertGeneratorKeys, caseContractKeys)
    ) {
        blockerCodes.push('watchlist_scope_mismatch')
    }

    for (const field of requiredPayloadShape) {
        if (!proof.integration.payloadShape.includes(field)) blockerCodes.push('payload_shape_missing')
    }

    if (
        proof.integration.nonmemberEnumeration
        || proof.alertBridge.queueVisibilityContract.actorVisibility.nonmemberEnumeration
        || proof.webhookBridge.deliveryContract.destinationSelection.nonmemberDestinationEnumeration
    ) {
        blockerCodes.push('nonmember_enumeration_enabled')
    }
    if (proof.integration.containsRawTerms) blockerCodes.push('raw_terms_enabled')
    if (
        !proof.alertBridge.queueVisibilityContract.redactedFields.includes('activeTerms[].term')
        || !proof.caseBridge.caseWorkflowContract.redactedFields.includes('case.evidence.rawContent')
        || !proof.webhookBridge.deliveryContract.redactedFields.includes('destination.secret')
        || !alertQueueVisibility.denialGuardrails.ok
        || !webhookSafety.ok
        || !caseSafety.ok
    ) {
        blockerCodes.push('redaction_missing')
    }
    if (!alertQueueVisibility.denialGuardrails.ok) blockerCodes.push('denial_guardrail_missing')
    if (!webhookSafety.ok) blockerCodes.push('webhook_guardrail_missing')
    if (!caseSafety.ok) blockerCodes.push('case_guardrail_missing')
    if (
        proof.alertBridge.queueVisibilityContract.routes.list !== 'GET /v1/dwm/alerts'
        || proof.alertBridge.queueVisibilityContract.routes.replay !== 'POST /v1/dwm/alerts/:id/replay'
        || proof.caseBridge.caseWorkflowContract.routes.open !== 'POST /v1/cases'
        || proof.webhookBridge.route !== 'POST /v1/dwm/webhooks/deliver'
    ) {
        blockerCodes.push('route_missing')
    }

    const uniqueBlockers = [...new Set(blockerCodes)]
    return {
        schemaVersion: 'organization.shared_watchlist_integration_guardrails.v1',
        ...organizationTenantIdentity(proof.organizationId, proof.tenantId),
        ok: uniqueBlockers.length === 0,
        checkedContracts: [
            'organization.shared_watchlist_downstream_proof.v1',
            'organization.watchlist_alert_persistence_contract.v1',
            'organization.watchlist_alert_visibility_contract.v1',
            'organization.watchlist_case_workflow_contract.v1',
            'organization.watchlist_webhook_delivery_contract.v1',
            'organization.shared_watchlist_audit_contract.v1',
        ],
        requiredPayloadShape,
        downstreamRoutes: {
            alertList: 'GET /v1/dwm/alerts',
            alertReplay: 'POST /v1/dwm/alerts/:id/replay',
            caseOpen: 'POST /v1/cases',
            webhookDeliver: 'POST /v1/dwm/webhooks/deliver',
        },
        orgScope: {
            ownerOrganizationId: proof.ownerOrganizationId,
            watchlistItemIds: watchlistIds,
            alertGeneratorKeys,
            alertContractOrgId: proof.alertBridge.persistenceContract.organizationId,
            caseContractOrgId: proof.caseBridge.caseWorkflowContract.organizationId,
            webhookContractOrgId: proof.webhookBridge.deliveryContract.organizationId,
        },
        safety: {
            nonmemberEnumeration: false,
            containsRawTerms: false,
            redactedFields: [
                ...new Set([
                    ...proof.alertBridge.queueVisibilityContract.redactedFields,
                    ...proof.caseBridge.caseWorkflowContract.redactedFields,
                    ...proof.webhookBridge.deliveryContract.redactedFields,
                ]),
            ].sort(),
        },
        denialSafety: {
            schemaVersion: alertQueueVisibility.denialGuardrails.schemaVersion,
            ok: alertQueueVisibility.denialGuardrails.ok,
            requiredNoLeakFields: alertQueueVisibility.denialGuardrails.requiredNoLeakFields,
            requiredResponseFields: alertQueueVisibility.denialGuardrails.requiredResponseFields,
            requiredAuditEvent: alertQueueVisibility.denialGuardrails.requiredAuditEvent,
            blockerCodes: alertQueueVisibility.denialGuardrails.blockerCodes,
        },
        webhookSafety,
        caseSafety,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        blockerCodes: uniqueBlockers,
    }
}

function sameStringSet(left: string[], right: string[]) {
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
}
