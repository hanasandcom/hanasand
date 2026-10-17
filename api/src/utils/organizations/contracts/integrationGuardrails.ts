import type { OrganizationSharedWatchlistAlertQueueVisibility } from './alertQueueVisibility.ts'

export type OrganizationSharedWatchlistIntegrationGuardrailCode =
    | 'schema_mismatch'
    | 'org_scope_mismatch'
    | 'watchlist_scope_mismatch'
    | 'alert_contract_missing'
    | 'case_contract_missing'
    | 'webhook_contract_missing'
    | 'payload_shape_missing'
    | 'nonmember_enumeration_enabled'
    | 'raw_terms_enabled'
    | 'redaction_missing'
    | 'denial_guardrail_missing'
    | 'webhook_guardrail_missing'
    | 'case_guardrail_missing'
    | 'route_missing'

export type OrganizationSharedWatchlistIntegrationGuardrails = {
    schemaVersion: 'organization.shared_watchlist_integration_guardrails.v1'
    organizationId: string
    tenantId: string
    ok: boolean
    checkedContracts: Array<
        | 'organization.shared_watchlist_downstream_proof.v1'
        | 'organization.watchlist_alert_persistence_contract.v1'
        | 'organization.watchlist_alert_visibility_contract.v1'
        | 'organization.watchlist_case_workflow_contract.v1'
        | 'organization.watchlist_webhook_delivery_contract.v1'
        | 'organization.shared_watchlist_audit_contract.v1'
    >
    requiredPayloadShape: string[]
    downstreamRoutes: {
        alertList: 'GET /v1/dwm/alerts'
        alertReplay: 'POST /v1/dwm/alerts/:id/replay'
        caseOpen: 'POST /v1/cases'
        webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
    }
    orgScope: {
        ownerOrganizationId: string
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertContractOrgId: string
        caseContractOrgId: string
        webhookContractOrgId: string
    }
    safety: {
        nonmemberEnumeration: false
        containsRawTerms: false
        redactedFields: string[]
    }
    denialSafety: {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1'
        ok: boolean
        requiredNoLeakFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredNoLeakFields']
        requiredResponseFields: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['requiredResponseFields']
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied'
        blockerCodes: OrganizationSharedWatchlistAlertQueueVisibility['denialGuardrails']['blockerCodes']
    }
    webhookSafety: {
        schemaVersion: 'organization.shared_watchlist_webhook_delivery_guardrails.v1'
        ok: boolean
        requiredIdempotencyFields: Array<'eventType' | 'organizationId' | 'destinationId' | 'alert.dedupeKey'>
        requiredEvidenceFields: Array<'deliveryId' | 'destinationId' | 'attemptedAt' | 'status' | 'casePath' | 'watchlistItemIds' | 'auditEventContracts'>
        requiredRedactedFields: Array<'destination.endpoint' | 'destination.secret' | 'activeTerms[].term'>
        destinationEnumerationAllowed: false
        requiredDestinationOrgId: string
        blockerCodes: Array<'webhook_idempotency_missing' | 'webhook_evidence_missing' | 'webhook_redaction_missing' | 'webhook_org_scope_missing' | 'webhook_destination_enumeration_enabled'>
    }
    caseSafety: {
        schemaVersion: 'organization.shared_watchlist_case_workflow_guardrails.v1'
        ok: boolean
        requiredCaseFields: Array<'organizationId' | 'tenantId' | 'alertId' | 'casePath' | 'watchlistItemIds' | 'allowedActions' | 'visibilityDecision' | 'evidence.provenance'>
        requiredTimelineEvents: Array<'case.opened' | 'case.linked_alert' | 'case.assigned' | 'case.status_changed' | 'case.note_added'>
        requiredEvidenceFields: Array<'alertId' | 'watchlistItemIds' | 'alertGeneratorKeys' | 'matchedTerms' | 'source' | 'capturedAt' | 'casePath'>
        requiredRedactedFields: Array<'activeTerms[].term' | 'case.evidence.rawContent'>
        casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
        actorCanOpenCase: boolean
        actorCanAssignCase: boolean
        blockerCodes: Array<'case_org_scope_missing' | 'case_path_missing' | 'case_fields_missing' | 'case_timeline_missing' | 'case_evidence_missing' | 'case_redaction_missing' | 'case_role_gate_missing'>
    }
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    blockerCodes: OrganizationSharedWatchlistIntegrationGuardrailCode[]
}
