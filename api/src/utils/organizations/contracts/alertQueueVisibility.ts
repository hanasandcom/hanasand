import type { OrganizationAlertCaseAction, OrganizationAlertCaseRole } from '../inputTypes.ts'
import type { OrganizationAlertVisibilityPolicy, OrganizationVisibilityDenyReason } from '../../organizationVisibility.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from './downstreamProof.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from './alertBridge.ts'

export type OrganizationSharedWatchlistAlertQueueVisibility = {
    schemaVersion: 'organization.shared_watchlist_alert_queue_visibility.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    routes: {
        list: 'GET /v1/dwm/alerts'
        detail: 'GET /v1/dwm/alerts/:id'
        update: 'PATCH /v1/dwm/alerts/:id'
        replay: 'POST /v1/dwm/alerts/:id/replay'
    }
    requiredQueryFields: Array<'organizationId'>
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    visibility: {
        policy: OrganizationAlertVisibilityPolicy
        allowed: boolean
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
        allowedRoles: OrganizationRole[]
        nonmemberEnumeration: false
    }
    denialResponseContract: {
        appliesWhen: 'visibility.allowed_false'
        blocked: boolean
        statusCode: 403
        errorCode: 'org_alert_visibility_denied'
        reason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | null
        responseShape: string[]
        safeFields: string[]
        noLeakFields: string[]
        auditEventAction: 'organization_watchlist_alert_visibility_denied'
    }
    denialGuardrails: {
        schemaVersion: 'organization.shared_watchlist_alert_denial_guardrails.v1'
        ok: boolean
        checkedFields: string[]
        requiredNoLeakFields: Array<'activeTerms' | 'watchlistScope.alertGeneratorKeys' | 'persistedAlertContract' | 'member.userId'>
        requiredResponseFields: Array<'error' | 'message' | 'organizationId' | 'visibilityDecision' | 'allowedRoles' | 'requestId'>
        requiredAuditEvent: 'organization_watchlist_alert_visibility_denied'
        blockerCodes: Array<'denial_status_missing' | 'denial_shape_missing' | 'denial_no_leak_missing' | 'denial_audit_missing'>
    }
    allowedActions: OrganizationAlertCaseAction[]
    actionGates: OrganizationSharedWatchlistDownstreamProof['alertBridge']['queueVisibilityContract']['actionGates']
    roleActionMatrix: {
        schemaVersion: 'organization.shared_watchlist_alert_role_matrix.v1'
        actorRole: OrganizationRole
        allowedActions: OrganizationAlertCaseAction[]
        roleGates: Record<OrganizationAlertCaseAction, OrganizationAlertCaseRole[]>
        allowedActionsByRole: Record<OrganizationAlertCaseRole, OrganizationAlertCaseAction[]>
        downstreamConsumers: Array<'alert_queue' | 'case_workflow' | 'webhook_delivery' | 'support_redacted_read'>
        deniedRoles: Array<'viewer' | 'support' | 'nonmember'>
        denialReason: 'role_not_allowed'
    }
    watchlistScope: {
        ownerOrganizationId: string
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
        visibilityDecisionField: 'workflowContext.visibilityDecision'
        dedupeScope: 'organization_watchlist_term'
        crossTenantCollisionAllowed: false
    }
    tenantIsolation: {
        schemaVersion: 'organization.shared_watchlist_alert_tenant_isolation.v1'
        partitionKey: 'organizationId'
        tenantIdField: 'tenantId'
        requiredAlertFields: Array<'organizationId' | 'tenantId' | 'watchlistItemIds' | 'workflowContext.organizationId' | 'workflowContext.alertGeneratorKeys' | 'dedupeKey'>
        dedupeKeyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        watchlistItemScope: 'organization_owned'
        crossTenantCollisionAllowed: false
        nonmemberEnumeration: false
        lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
        proofAssertions: Array<'two_org_overlapping_terms' | 'distinct_alert_generator_keys' | 'org_scoped_watchlist_ids' | 'visibility_query_requires_organization_id'>
    }
    lifecycleExclusions: {
        excludedStatuses: Array<'paused' | 'archived'>
        pausedWatchlistIds: string[]
        archivedWatchlistIds: string[]
        blockerCodes: Array<'watchlist_paused' | 'watchlist_archived'>
    }
    persistedAlertContract: {
        storageModule: 'scraper/src/storage/dwmAlertRepository.ts'
        requiredFields: string[]
        workflowContextFields: string[]
        persistedAlertFields: string[]
        casePathField: 'casePath'
    }
    consumerContract: {
        ownerLane: 'dwm_alert_workflow'
        expectedAdapter: 'organizationSharedWatchlistAlertQueueVisibility'
        payloadShape: string[]
        requiredRouteBinding: 'organizationId_query_and_workflow_context'
        requiredStorageBinding: 'workflowContext.organizationId'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    auditContract: {
        source: 'events'
        requiredEventActions: string[]
        requiredMetadataFields: string[]
        requestIdFields: string[]
        downstreamCorrelationFields: string[]
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist'
    }
    support: {
        mode: 'redacted_summary_only'
        redactionRequired: true
        supportOnlyBlocker: 'support_only_access'
    }
    safeFields: string[]
    redactedFields: string[]
    blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
