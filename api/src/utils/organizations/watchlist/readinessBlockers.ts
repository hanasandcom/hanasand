import type { OrganizationLifecycleStatus } from '../inputTypes.ts'
import type { OrganizationWatchlistAlertBridgeBlocker } from '../contracts/alertBridge.ts'

export function organizationWatchlistLifecycleBlockers(input: {
    activeTermCount: number
    pausedCount: number
    archivedCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_terms',
            severity: 'blocker',
            message: 'No active organization watchlist terms are available for alert replay.',
        })
        blockers.push({
            code: 'alert_bridge_unavailable',
            severity: 'blocker',
            message: 'Alert replay is unavailable until at least one active org watchlist term is exported.',
        })
    }

    if (input.pausedCount > 0) {
        blockers.push({
            code: 'watchlist_paused',
            severity: 'notice',
            message: 'Paused org watchlist items are excluded from alert replay until resumed.',
            count: input.pausedCount,
        })
    }

    if (input.archivedCount > 0) {
        blockers.push({
            code: 'watchlist_archived',
            severity: 'notice',
            message: 'Archived org watchlist items are excluded from alert replay and remain available for cleanup audit.',
            count: input.archivedCount,
        })
    }

    if (input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'cleanup_required',
            severity: 'notice',
            message: 'Paused or archived org watchlist items exist; repeatable cleanup/list flows should account for them.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    return blockers
}

export function organizationWatchlistAlertBridgeBlockers(input: {
    organizationId: string
    tenantId: string
    organizationStatus: OrganizationLifecycleStatus
    activeAdminCount: number
    activeTermCount: number
    pausedCount: number
    archivedCount: number
    missingAlertRefCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (!input.organizationId || !input.tenantId) {
        blockers.push({
            code: 'missing_org_tenant',
            severity: 'blocker',
            message: 'Organization and tenant ids are required before org watchlist terms can generate alerts.',
        })
    }

    if (input.organizationStatus !== 'active') {
        blockers.push({
            code: input.organizationStatus === 'archived' ? 'org_archived' : 'org_deleted',
            severity: 'blocker',
            message: 'Organization lifecycle is not active, so org watchlist terms must not generate alerts.',
        })
    }

    if (input.activeAdminCount < 1) {
        blockers.push({
            code: 'no_active_admin',
            severity: 'blocker',
            message: 'At least one active owner/admin is required before org watchlist alerts can be generated safely.',
        })
    }

    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_watchlist_terms',
            severity: 'blocker',
            message: 'No active organization watchlist terms are available for alert generation.',
        })
    }

    if (input.missingAlertRefCount > 0) {
        blockers.push({
            code: 'no_alert_ref',
            severity: 'blocker',
            message: 'One or more active terms is missing alertGenerationRef metadata.',
            count: input.missingAlertRefCount,
        })
    }

    if (input.pausedCount > 0) {
        blockers.push({
            code: 'paused_watchlist_excluded',
            severity: 'notice',
            message: 'Paused watchlist items are auditable but excluded from active alert matching.',
            count: input.pausedCount,
        })
    }

    if (input.archivedCount > 0) {
        blockers.push({
            code: 'archived_watchlist_excluded',
            severity: 'notice',
            message: 'Archived watchlist items are auditable but excluded from active alert matching.',
            count: input.archivedCount,
        })
    }

    return blockers
}
