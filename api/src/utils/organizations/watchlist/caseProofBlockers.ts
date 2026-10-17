import type { OrganizationWatchlistAlertBridgeBlocker } from '../contracts/alertBridge.ts'

export function organizationWatchlistAlertCaseProofBlockers(input: {
    organizationId: string
    tenantId: string
    activeAdminCount: number
    activeTermCount: number
    pausedCount: number
    archivedCount: number
}): OrganizationWatchlistAlertBridgeBlocker[] {
    const blockers: OrganizationWatchlistAlertBridgeBlocker[] = []
    if (!input.organizationId || !input.tenantId) {
        blockers.push({
            code: 'no_active_org',
            severity: 'blocker',
            message: 'An active organization and tenant id are required for org-scoped alert/case handoff.',
        })
    }

    if (input.activeAdminCount < 1) {
        blockers.push({
            code: 'no_active_admin',
            severity: 'blocker',
            message: 'Org alert/case handoff requires at least one active owner/admin.',
        })
    }

    if (input.activeTermCount === 0) {
        blockers.push({
            code: 'no_active_terms',
            severity: 'blocker',
            message: 'No active org watchlist terms are available for alert/case replay.',
        })
        blockers.push({
            code: 'alert_export_unavailable',
            severity: 'blocker',
            message: 'Alert export is unavailable until active org watchlist terms exist.',
        })
    }

    if (input.activeTermCount === 0 && input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'paused_archived_only',
            severity: 'blocker',
            message: 'Only paused or archived org watchlist terms exist, so active alert matching must remain disabled.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    if (input.pausedCount + input.archivedCount > 0) {
        blockers.push({
            code: 'cleanup_required',
            severity: 'notice',
            message: 'Paused or archived watchlist terms are excluded from matching and should be cleaned up after proof runs.',
            count: input.pausedCount + input.archivedCount,
        })
    }

    return blockers
}
