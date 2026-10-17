import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationAlertCaseRole, OrganizationSharedWatchlistAnalystPortalAction } from '../inputTypes.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from './alertBridge.ts'
import type { OrganizationVisibilityDenyReason } from '../../organizationVisibility.ts'

export type OrganizationSharedWatchlistConsumerReadiness = {
    schemaVersion: 'organization.shared_watchlist_consumer_readiness.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    routes: {
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        alertList: 'GET /v1/dwm/alerts'
        alertReplay: 'POST /v1/dwm/alerts/:id/replay'
        caseList: 'GET /v1/cases'
        caseOpen: 'POST /v1/cases'
        webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
        supportInspection: 'GET /api/admin/support/organizations/:id'
        dashboardReadiness: 'GET /api/organizations/:id/alert-readiness'
    }
    watchlists: {
        activeCount: number
        pausedCount: number
        archivedCount: number
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        alertGeneratorKeys: string[]
        crossTenantCollisionAllowed: false
    }
    readiness: {
        alertQueueReady: boolean
        caseWorkflowReady: boolean
        webhookDeliveryReady: boolean
        supportRedactedReadReady: boolean
        dashboardReadinessReady: boolean
    }
    roleGates: {
        mutateWatchlists: Array<'owner' | 'admin' | 'editor'>
        exportTerms: OrganizationRole[]
        manualWebhookTrigger: Array<'owner' | 'admin' | 'editor'>
        assignCase: OrganizationAlertCaseRole[]
    }
    blockers: string[]
    noLeakFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationAnalystPortalVisibilityAdapter = {
    schemaVersion: 'organization.analyst_portal_visibility_adapter.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    member: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    routeBindings: {
        alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId'
        alertDetail: 'GET /v1/dwm/alerts/:id'
        caseList: 'GET /v1/cases?organizationId=:organizationId'
        caseDetail: 'GET /v1/cases/:id'
        webhookDelivery: 'POST /v1/dwm/webhooks/deliver'
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
    }
    requiredIdentityFields: Array<'organizationId' | 'tenantId' | 'member.userId' | 'member.role' | 'watchlistItemIds[]' | 'workflowContext.visibilityDecision'>
    watchlistScope: {
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        itemIdField: 'watchlistItemIds[]'
        alertGeneratorKeyField: 'workflowContext.alertGeneratorKeys[]'
        crossTenantCollisionAllowed: false
    }
    actionMatrix: Record<OrganizationSharedWatchlistAnalystPortalAction, {
        allowed: boolean
        allowedRoles: OrganizationAlertCaseRole[]
        denialReason: OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason | 'manual_webhook_selection_required' | null
        blockerCodes: string[]
    }>
    allowedActions: OrganizationSharedWatchlistAnalystPortalAction[]
    lifecycleBlockers: string[]
    consumerProof: {
        alertQueueAdapter: 'organizationSharedWatchlistAlertQueueVisibility'
        caseWorkflowAdapter: 'organization.watchlist_case_workflow_contract.v1'
        webhookGuardrailAdapter: 'organizationSharedWatchlistWebhookDeliveryGuardrails'
        auditAdapter: 'organizationSharedWatchlistAuditEventBridge'
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
    }
    redaction: {
        safeFields: string[]
        redactedFields: Array<'activeTerms[].term' | 'activeTerms[].value' | 'case.evidence.rawContent' | 'destination.secret' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys'>
        nonmemberEnumeration: false
    }
}
