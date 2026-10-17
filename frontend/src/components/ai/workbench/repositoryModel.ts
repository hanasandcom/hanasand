'use client'

export function withRepositorySync(
    repo: AIImportedRepo,
    update: {
        status: 'ready' | 'syncing' | 'error'
        source: 'import' | 'refresh' | 'sync'
        message: string
    },
): AIImportedRepo {
    const event: AIRepositorySyncEvent = {
        timestamp: new Date().toISOString(),
        status: update.status,
        source: update.source,
        message: update.message,
    }

    return {
        ...repo,
        syncStatus: update.status,
        lastSyncedAt: update.status === 'ready' ? event.timestamp : repo.lastSyncedAt,
        lastSyncError: update.status === 'error' ? update.message : null,
        syncHistory: [event, ...(repo.syncHistory || [])].slice(0, 10),
    }
}

export function withWorkspaceActivity(
    workspaceMeta: Record<string, unknown>,
    update: {
        action: string
        path?: string
        source?: 'share' | 'repository-sync' | 'scaffold'
    },
) {
    const existingRecentPaths = Array.isArray(workspaceMeta.recentPaths)
        ? workspaceMeta.recentPaths.filter((entry): entry is string => typeof entry === 'string')
        : []
    const recentPaths = update.path
        ? [update.path, ...existingRecentPaths.filter((entry) => entry !== update.path)].slice(0, 8)
        : existingRecentPaths

    return {
        ...workspaceMeta,
        recentPaths,
        lastChangedPath: update.path || workspaceMeta.lastChangedPath || null,
        lastWorkspaceAction: update.action,
        lastWorkspaceActionAt: new Date().toISOString(),
        workspaceSource: update.source || workspaceMeta.workspaceSource || null,
    }
}

export function withFocusedWorkspaceFile(workspaceMeta: Record<string, unknown>, path: string, action: string) {
    return withWorkspaceActivity({ ...workspaceMeta, selectedFilePath: path }, { action, path })
}
