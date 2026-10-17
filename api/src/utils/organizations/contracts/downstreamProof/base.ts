import type { OrganizationAlertCaseAction, OrganizationSharedWatchlistAuditEventAction, OrganizationSharedWatchlistAuditRouteGroup, OrganizationSharedWatchlistAuditConsumer, OrganizationWatchlistStatus } from '../../inputTypes.ts'
import type { OrganizationRole } from '../../../organizationRoles.ts'

export type OrganizationSharedWatchlistDownstreamProofBase = {
    schemaVersion: 'organization.shared_watchlist_downstream_proof.v1'
    organizationId: string
    tenantId: string
    ownerOrganizationId: string
    actor: {
        userId: string
        role: OrganizationRole
        status: 'active'
        canManageWatchlists: boolean
        canExportActiveTerms: boolean
        allowedActions: OrganizationAlertCaseAction[]
    }
    inviteLifecycle: {
        pendingInviteCount: number
        acceptedInviteCreatesMembership: true
        acceptedInviteRevocationBlocked: true
        expiredInviteBlocker: 'invite_expired'
        revokedInviteBlocker: 'member_revoked'
        removedMemberReinviteBlocked: true
        deactivatedUserInviteBlocked: true
        memberRemovalRevokesPendingInvites: true
        memberRemovalCleanupSchema: 'organization.member_removal_cleanup.v1'
        memberRemovalCleanupField: 'memberRemovalCleanup.revokedInviteIds'
        staleInviteAcceptanceBlocker: 'member_revoked'
    }
    watchlistOwnership: {
        activeIds: string[]
        pausedIds: string[]
        archivedIds: string[]
        activeCount: number
        pausedCount: number
        archivedCount: number
        ownerOrganizationId: string
        isolatedByOrganizationId: true
        duplicateTermScope: 'organization'
        lifecycleStatuses: Array<{
            watchlistItemId: string
            organizationId: string
            status: OrganizationWatchlistStatus
            createdBy: string
            updatedBy: string | null
        }>
    }
    audit: {
        schemaVersion: 'organization.shared_watchlist_audit_contract.v1'
        source: 'events'
        eventActions: OrganizationSharedWatchlistAuditEventAction[]
        requiredMetadataFields: string[]
        requestIdFields: string[]
        actorFields: string[]
        downstreamCorrelationFields: string[]
        idempotentActions: Array<'invite_resend' | 'invite_revoke' | 'watchlist_cleanup' | 'alert_terms_export'>
        proofLogQuery: 'GET /api/logs?service=api&message=organization_watchlist'
        eventBridge: {
            schemaVersion: 'organization.shared_watchlist_audit_event_bridge.v1'
            source: 'events'
            expectedAdapter: 'organizationSharedWatchlistAuditEventBridge'
            requiredActions: OrganizationSharedWatchlistAuditEventAction[]
            eventDescriptors: Array<{
                action: OrganizationSharedWatchlistAuditEventAction
                routeGroup: OrganizationSharedWatchlistAuditRouteGroup
                outcome: 'success' | 'denied' | 'blocked'
                requestIdField: 'metadata.requestId'
                actorField: 'actor.userId'
                organizationField: 'organizationId'
                requiredMetadataFields: string[]
                redactedMetadataFields: Array<'metadata.value' | 'metadata.email' | 'activeTerms[].term' | 'alertBridge.alertGeneratorKeys'>
                downstreamConsumers: OrganizationSharedWatchlistAuditConsumer[]
                idempotent: boolean
            }>
            requiredSafeFields: Array<'action' | 'routeGroup' | 'outcome' | 'requestIdField' | 'actorField' | 'organizationField'>
            requiredRedactedFields: Array<'metadata.value' | 'metadata.email' | 'activeTerms[].term' | 'alertBridge.alertGeneratorKeys'>
            noRawTermAccess: true
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts'
            blockerCodes: Array<'missing_required_action' | 'missing_request_id' | 'missing_actor' | 'missing_redaction' | 'raw_term_access_enabled'>
        }
    }

}
