import type { OrganizationAlertCaseAction, OrganizationAlertCaseRole } from '../../inputTypes.ts'
import type { OrganizationRole } from '../../../organizationRoles.ts'
import type { OrganizationVisibilityDenyReason } from '../../../organizationVisibility.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../alertBridge.ts'

export type OrganizationWatchlistTermExportDeltaReceipt = {
    schemaVersion: 'organization.watchlist_term_export_delta_receipt.v1'
    organizationId: string
    tenantId: string
    actor: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    route: 'GET /api/organizations/:id/watchlists/alert-terms'
    activeTermCount: number
    exportedWatchlistItemIds: string[]
    exportedAlertGeneratorKeys: string[]
    excludedTermCount: number
    excludedWatchlistItemIds: string[]
    excludedReasons: Array<'watchlist_paused' | 'watchlist_archived'>
    lifecycle: {
        activeItemIds: string[]
        pausedItemIds: string[]
        archivedItemIds: string[]
        deletedTermIds: string[]
    }
    downstreamRefs: {
        alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
        alertPersistenceContract: 'organization.watchlist_alert_persistence_contract.v1'
        caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
        webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1'
    }
    roleGates: {
        exportTerms: OrganizationRole[]
        mutateWatchlists: Array<'owner' | 'admin' | 'editor'>
        readSharedWatchlists: OrganizationRole[]
    }
    blockerCodes: string[]
    stableDedupeFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
    nonmemberEnumeration: false
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationWatchlistAlertCasePersistenceReceipt = {
    schemaVersion: 'organization.alert_case_bridge_persistence_receipt.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    alertPersistenceContract: 'organization.watchlist_alert_persistence_contract.v1'
    caseWorkflowContract: 'organization.watchlist_case_workflow_contract.v1'
    storageModule: 'scraper/src/storage/dwmAlertRepository.ts'
    alertUpsertFunction: 'upsertDwmAlert'
    alertRoute: 'organization_watchlist'
    caseRoute: 'POST /v1/cases'
    casePathTemplate: '/dwm?organizationId=:organizationId&watchlistItemId=:watchlistItemId'
    watchlistScope: {
        watchlistItemIds: string[]
        alertGeneratorKeys: string[]
        crossTenantCollisionAllowed: false
    }
    requiredAlertFields: string[]
    requiredCaseFields: string[]
    workflowContextFields: string[]
    dedupe: {
        scope: 'organization_watchlist_term'
        keyFields: Array<'organizationId' | 'watchlistItemId' | 'termFamily' | 'normalizedTerm'>
        crossTenantCollisionAllowed: false
    }
    lifecycleBlockers: Array<'org_archived' | 'org_deleted' | 'watchlist_paused' | 'watchlist_archived' | 'member_revoked' | 'nonmember_denied'>
    actorActions: OrganizationAlertCaseAction[]
    blockerCodes: Array<OrganizationWatchlistAlertBridgeBlockerCode | OrganizationVisibilityDenyReason>
    noEnumeration: false
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}

export type OrganizationWatchlistReadinessExport = {
    schemaVersion: 'organization.shared_watchlist_readiness_export.v1'
    organizationId: string
    tenantId: string
    sourceFamily: 'organization_watchlist'
    actor: {
        userId: string
        role: OrganizationRole
        status: 'active'
    }
    routes: {
        alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms'
        alertQueue: 'GET /v1/dwm/alerts'
        caseVisibility: 'GET /api/organizations/:id/alert-case-visibility'
        caseOpen: 'POST /v1/cases'
        webhookDeliver: 'POST /v1/dwm/webhooks/deliver'
        dashboardReadiness: 'GET /api/organizations/:id/alert-readiness'
    }
    readiness: {
        alertExportReady: boolean
        alertQueueReady: boolean
        casePersistenceReady: boolean
        caseVisibilityReady: boolean
        webhookDestinationReady: boolean
        supportRedactedReadReady: boolean
        dashboardReadinessReady: boolean
    }
    watchlistScope: {
        activeItemIds: string[]
        pausedItemIds: string[]
        archivedItemIds: string[]
        alertGeneratorKeys: string[]
        crossTenantCollisionAllowed: false
    }
    userLocalIsolation: {
        schemaVersion: 'organization.user_local_watchlist_isolation.v1'
        sourceOfTruth: 'organization_watchlist_items'
        organizationScopeField: 'organization_id'
        requiredQueryFields: Array<'organizationId'>
        excludedSources: Array<'user_local_watchlists' | 'session_watchlists' | 'demo_watchlists'>
        forbiddenFallbacks: Array<'userId_only' | 'session_only' | 'missing_organization_id'>
        activeWatchlistItemIds: string[]
        alertGeneratorKeys: string[]
        crossOrgDedupeAllowed: false
        nonmemberEnumeration: false
        noLeakFields: Array<'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'userLocal.watchlistItems' | 'session.watchlistItems'>
        proofAssertions: Array<'requires_org_id' | 'two_org_overlapping_terms_distinct_keys' | 'nonmember_cannot_enumerate_terms' | 'removed_member_cannot_export_terms'>
    }
    downstreamRefs: {
        alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1'
        alertPersistenceReceipt: 'organization.alert_case_bridge_persistence_receipt.v1'
        caseVisibilityConsumer: 'organization.case_visibility_consumer.v1'
        webhookDestinationOwnership: 'organization.webhook_destination_ownership.v1'
        webhookDestinationAccessDecision: 'organization.webhook_destination_access_decision.v1'
        termExportDeltaReceipt: 'organization.watchlist_term_export_delta_receipt.v1'
    }
    roleGates: {
        exportTerms: OrganizationRole[]
        mutateWatchlists: Array<'owner' | 'admin' | 'editor'>
        manualWebhookTrigger: Array<'owner' | 'admin' | 'editor'>
        assignCase: OrganizationAlertCaseRole[]
    }
    lifecycleAccess: {
        activeMembershipRequired: true
        removedMemberBlocker: 'member_revoked'
        revokedInviteBlocker: 'member_revoked'
        expiredInviteBlocker: 'invite_expired'
        pausedWatchlistBlocker: 'watchlist_paused'
        archivedWatchlistBlocker: 'watchlist_archived'
        nonmemberEnumeration: false
    }
    blockers: string[]
    noLeakFields: Array<'activeTerms[].term' | 'otherOrg.watchlistItemIds' | 'otherOrg.alertGeneratorKeys' | 'destination.secret' | 'case.evidence.rawContent'>
    proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
}
