import type { OrganizationSharedWatchlistAuditEventAction, OrganizationSharedWatchlistAuditConsumer, OrganizationSharedWatchlistAuditRouteGroup } from '../inputTypes.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'

export const organizationSharedWatchlistAuditEventActions: readonly OrganizationSharedWatchlistAuditEventAction[] = [
    'organization_invites_created',
    'organization_invite_accepted',
    'organization_invite_revoked',
    'organization_invite_resent',
    'organization_watchlist_upserted',
    'organization_watchlist_updated',
    'organization_watchlist_paused',
    'organization_watchlist_resumed',
    'organization_watchlist_archived',
    'organization_watchlist_restored',
    'organization_watchlist_cleanup_archived',
    'organization_watchlist_alert_terms_exported',
    'organization_watchlist_alert_terms_export_denied',
    'organization_lifecycle_mutation_blocked',
]

export function organizationSharedWatchlistAuditEventBridge(
    eventActions: OrganizationSharedWatchlistAuditEventAction[]
): OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge'] {
    const requiredActions = [...organizationSharedWatchlistAuditEventActions]
    const requiredSafeFields: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['requiredSafeFields'] = [
        'action',
        'routeGroup',
        'outcome',
        'requestIdField',
        'actorField',
        'organizationField',
    ]
    const requiredRedactedFields: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['requiredRedactedFields'] = [
        'metadata.value',
        'metadata.email',
        'activeTerms[].term',
        'alertBridge.alertGeneratorKeys',
    ]
    const eventDescriptors = eventActions.map(action => ({
        action,
        routeGroup: organizationSharedWatchlistAuditRouteGroup(action),
        outcome: organizationSharedWatchlistAuditOutcome(action),
        requestIdField: 'metadata.requestId' as const,
        actorField: 'actor.userId' as const,
        organizationField: 'organizationId' as const,
        requiredMetadataFields: organizationSharedWatchlistAuditMetadataFields(action),
        redactedMetadataFields: requiredRedactedFields,
        downstreamConsumers: organizationSharedWatchlistAuditConsumers(action),
        idempotent: organizationSharedWatchlistAuditIsIdempotent(action),
    }))
    const blockerCodes: OrganizationSharedWatchlistDownstreamProof['audit']['eventBridge']['blockerCodes'] = []

    if (!requiredActions.every(action => eventActions.includes(action))) {
        blockerCodes.push('missing_required_action')
    }
    if (!eventDescriptors.every(descriptor => descriptor.requestIdField === 'metadata.requestId')) {
        blockerCodes.push('missing_request_id')
    }
    if (!eventDescriptors.every(descriptor => descriptor.actorField === 'actor.userId')) {
        blockerCodes.push('missing_actor')
    }
    if (!eventDescriptors.every(descriptor => requiredRedactedFields.every(field => descriptor.redactedMetadataFields.includes(field)))) {
        blockerCodes.push('missing_redaction')
    }

    return {
        schemaVersion: 'organization.shared_watchlist_audit_event_bridge.v1',
        source: 'events',
        expectedAdapter: 'organizationSharedWatchlistAuditEventBridge',
        requiredActions,
        eventDescriptors,
        requiredSafeFields,
        requiredRedactedFields,
        noRawTermAccess: true,
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        blockerCodes,
    }
}

function organizationSharedWatchlistAuditRouteGroup(action: OrganizationSharedWatchlistAuditEventAction): OrganizationSharedWatchlistAuditRouteGroup {
    if (action.startsWith('organization_invite')) return 'invite_lifecycle'
    if (action === 'organization_watchlist_upserted' || action === 'organization_watchlist_updated') return 'watchlist_write'
    if (action === 'organization_watchlist_alert_terms_exported' || action === 'organization_watchlist_alert_terms_export_denied') return 'alert_terms_export'
    if (action === 'organization_lifecycle_mutation_blocked') return 'lifecycle_blocker'
    return 'watchlist_lifecycle'
}

function organizationSharedWatchlistAuditOutcome(action: OrganizationSharedWatchlistAuditEventAction): 'success' | 'denied' | 'blocked' {
    if (action.endsWith('_denied')) return 'denied'
    if (action.endsWith('_blocked')) return 'blocked'
    return 'success'
}

function organizationSharedWatchlistAuditMetadataFields(action: OrganizationSharedWatchlistAuditEventAction): string[] {
    if (action.startsWith('organization_invite')) {
        return ['requestId', 'inviteId', 'role', 'reason', 'expiresAt']
    }
    if (action === 'organization_watchlist_cleanup_archived') {
        return ['requestId', 'reason', 'requestedItemIds', 'archivedItemIds', 'skippedItemIds', 'archivedCount']
    }
    if (action === 'organization_watchlist_alert_terms_exported') {
        return ['requestId', 'activeTermCount', 'pausedCount', 'archivedCount', 'canGenerateAlerts']
    }
    if (action === 'organization_watchlist_alert_terms_export_denied') {
        return ['requestId', 'role', 'alertVisibilityPolicy', 'allowedRoles', 'denialReason', 'blockerCodes']
    }
    if (action === 'organization_lifecycle_mutation_blocked') {
        return ['requestId', 'blockerCode', 'blockedAction', 'actorRole']
    }
    return ['requestId', 'watchlistItemId', 'kind', 'reason', 'action', 'status']
}

function organizationSharedWatchlistAuditConsumers(action: OrganizationSharedWatchlistAuditEventAction): OrganizationSharedWatchlistAuditConsumer[] {
    if (action === 'organization_watchlist_alert_terms_exported') {
        return ['alert_queue', 'case_workflow', 'webhook_delivery', 'dashboard_readiness']
    }
    if (action === 'organization_watchlist_alert_terms_export_denied') {
        return ['alert_queue', 'dashboard_readiness']
    }
    if (action.startsWith('organization_watchlist')) {
        return ['alert_queue', 'dashboard_readiness']
    }
    return ['dashboard_readiness']
}

function organizationSharedWatchlistAuditIsIdempotent(action: OrganizationSharedWatchlistAuditEventAction): boolean {
    return action === 'organization_invite_resent'
        || action === 'organization_invite_revoked'
        || action === 'organization_watchlist_cleanup_archived'
        || action === 'organization_watchlist_alert_terms_exported'
}
