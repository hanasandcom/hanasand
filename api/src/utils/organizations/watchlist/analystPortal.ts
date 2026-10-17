import { roleCanEditOrganization } from '../../organizationRoles.ts'
import type { OrganizationAnalystPortalVisibilityAdapter } from '../contracts/consumerAdapters.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationDownstreamAuthorizationExport } from '../contracts/downstreamAuthorization.ts'
import type { OrganizationSharedWatchlistAnalystPortalAction } from '../inputTypes.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../contracts/alertBridge.ts'
import { organizationRolesFor } from '../authorization/roleActions.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationAnalystPortalVisibilityAdapter(
    proof: OrganizationSharedWatchlistDownstreamProof,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
): OrganizationAnalystPortalVisibilityAdapter {
    const alertBlockers = proof.alertBridge.blockerCodes.map(String)
    const caseBlockers = proof.caseBridge.blockerCodes.map(String)
    const webhookBlockers = proof.webhookBridge.blockerCodes.map(String)
    const visibilityDenied = downstreamAuthorization.visibility.allowed ? null : downstreamAuthorization.visibility.reason
    const actionMatrix: OrganizationAnalystPortalVisibilityAdapter['actionMatrix'] = {
        review_alert: {
            allowed: downstreamAuthorization.visibility.allowed && alertBlockers.length === 0,
            allowedRoles: downstreamAuthorization.visibility.allowedRoles,
            denialReason: visibilityDenied ?? (alertBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined) ?? null,
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        acknowledge_alert: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('acknowledge_alert')
                && alertBlockers.length === 0,
            allowedRoles: organizationRolesFor('watchlistEditors'),
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('acknowledge_alert') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        assign_case: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('assign_case')
                && caseBlockers.length === 0,
            allowedRoles: organizationRolesFor('alertCaseActors'),
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('assign_case') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? caseBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        link_case: {
            allowed: downstreamAuthorization.visibility.allowed
                && downstreamAuthorization.allowedActions.includes('link_case')
                && caseBlockers.length === 0,
            allowedRoles: organizationRolesFor('alertCaseActors'),
            denialReason: visibilityDenied ?? (downstreamAuthorization.allowedActions.includes('link_case') ? null : 'role_not_allowed'),
            blockerCodes: downstreamAuthorization.visibility.allowed ? caseBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        replay_alert: {
            allowed: downstreamAuthorization.visibility.allowed && roleCanEditOrganization(downstreamAuthorization.member.role) && alertBlockers.length === 0,
            allowedRoles: organizationRolesFor('watchlistEditors'),
            denialReason: visibilityDenied ?? (alertBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined) ?? null,
            blockerCodes: downstreamAuthorization.visibility.allowed ? alertBlockers : [visibilityDenied ?? 'role_not_allowed'],
        },
        deliver_webhook: {
            allowed: proof.webhookBridge.deliveryContract.roleGates.manualTriggerAllowed
                && webhookBlockers.length === 0,
            allowedRoles: organizationRolesFor('watchlistEditors'),
            denialReason: proof.webhookBridge.deliveryContract.roleGates.denialReason
                ?? (webhookBlockers[0] as OrganizationWatchlistAlertBridgeBlockerCode | undefined)
                ?? null,
            blockerCodes: webhookBlockers,
        },
        open_audit_timeline: {
            allowed: downstreamAuthorization.visibility.allowed,
            allowedRoles: organizationRolesFor('supportTimelineReaders'),
            denialReason: visibilityDenied,
            blockerCodes: downstreamAuthorization.visibility.allowed ? [] : [visibilityDenied ?? 'role_not_allowed'],
        },
    }
    const allowedActions = Object.entries(actionMatrix)
        .filter(([, gate]) => gate.allowed)
        .map(([action]) => action as OrganizationSharedWatchlistAnalystPortalAction)

    return {
        schemaVersion: 'organization.analyst_portal_visibility_adapter.v1',
        ...organizationTenantIdentity(proof.organizationId, proof.tenantId),
        sourceFamily: 'organization_watchlist',
        member: proof.actor,
        routeBindings: {
            alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId',
            alertDetail: 'GET /v1/dwm/alerts/:id',
            caseList: 'GET /v1/cases?organizationId=:organizationId',
            caseDetail: 'GET /v1/cases/:id',
            webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
        },
        requiredIdentityFields: [
            'organizationId',
            'tenantId',
            'member.userId',
            'member.role',
            'watchlistItemIds[]',
            'workflowContext.visibilityDecision',
        ],
        watchlistScope: {
            activeWatchlistItemIds: proof.watchlistOwnership.activeIds,
            alertGeneratorKeys: proof.alertBridge.alertGeneratorKeys,
            itemIdField: 'watchlistItemIds[]',
            alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]',
            crossTenantCollisionAllowed: false,
        },
        actionMatrix,
        allowedActions,
        lifecycleBlockers: proof.alertBridge.persistenceContract.lifecycleBlockers,
        consumerProof: {
            alertQueueAdapter: 'organizationSharedWatchlistAlertQueueVisibility',
            caseWorkflowAdapter: 'organization.watchlist_case_workflow_contract.v1',
            webhookGuardrailAdapter: 'organizationSharedWatchlistWebhookDeliveryGuardrails',
            auditAdapter: 'organizationSharedWatchlistAuditEventBridge',
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        redaction: {
            safeFields: [
                'organizationId',
                'tenantId',
                'member.role',
                'allowedActions',
                'actionMatrix',
                'watchlistScope.activeWatchlistItemIds',
                'watchlistScope.alertGeneratorKeys',
            ],
            redactedFields: [
                'activeTerms[].term',
                'activeTerms[].value',
                'case.evidence.rawContent',
                'destination.secret',
                'otherOrg.watchlistItemIds',
                'otherOrg.alertGeneratorKeys',
            ],
            nonmemberEnumeration: false,
        },
    }
}
