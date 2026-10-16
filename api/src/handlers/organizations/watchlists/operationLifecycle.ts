export function organizationWatchlistOperationLifecycle(action: 'created' | 'updated' | 'disabled' | 'pause' | 'resume' | 'archive' | 'restore') {
    if (action === 'pause') {
        return {
            statusAfter: 'paused' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_paused' as const,
        }
    }
    if (action === 'archive' || action === 'disabled') {
        return {
            statusAfter: 'archived' as const,
            enabledAfter: false,
            disabledReasonAfter: 'watchlist_archived' as const,
        }
    }
    return {
        statusAfter: 'active' as const,
        enabledAfter: true,
        disabledReasonAfter: null,
    }
}
