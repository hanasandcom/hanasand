import config from '@/config'

export async function getAiWorkspace({
    id,
    token,
}: {
    id?: string
    token?: string
}): Promise<AIWorkspaceBundle> {
    if (!id || !token) {
        return { authStatus: 'unauthenticated', conversations: [], repositories: [], deployments: [], releases: [], deployQuota: null, ownershipSummary: null, runtimeState: null }
    }
    let response: Response
    try {
        const normalizedToken = decodeURIComponent(token)
        response = await fetch(`${config.url.api}/ai/workspace`, {
            headers: {
                Authorization: `Bearer ${normalizedToken}`,
                id,
            },
            cache: 'no-store',
        })
    } catch {
        return emptyWorkspace('unavailable')
    }

    if (response.status === 401) return emptyWorkspace('unauthorized')
    if (!response.ok) return emptyWorkspace('unavailable')

    const data = await response.json().catch(() => null)
    if (!data || !Array.isArray(data.conversations)) return emptyWorkspace('unavailable')
    return {
        authStatus: 'ready',
        conversations: Array.isArray(data?.conversations) ? data.conversations : [],
        repositories: Array.isArray(data?.repositories)
            ? data.repositories.map((repository: AIImportedRepo) => ({
                ...repository,
                authMode: repository.authMode || 'public',
                authHint: repository.authHint || null,
                credential: repository.credential && typeof repository.credential === 'object'
                    ? repository.credential
                    : {
                        provider: 'github_pat',
                        hasCredential: false,
                        tokenHint: null,
                        attachedAt: null,
                        lastUsedAt: null,
                        lastValidatedAt: null,
                    },
                syncStatus: repository.syncStatus || 'ready',
                lastSyncedAt: repository.lastSyncedAt || null,
                lastSyncError: repository.lastSyncError || null,
                syncHistory: Array.isArray(repository.syncHistory) ? repository.syncHistory : [],
                stackType: repository.stackType || 'unknown',
                stackReason: repository.stackReason || null,
            }))
            : [],
        deployments: Array.isArray(data?.deployments) ? data.deployments : [],
        releases: Array.isArray(data?.releases) ? data.releases : [],
        deployQuota: data?.deployQuota && typeof data.deployQuota === 'object' ? data.deployQuota as AIDeployQuota : null,
        ownershipSummary: data?.ownershipSummary && typeof data.ownershipSummary === 'object' ? data.ownershipSummary as AIOwnershipSummary : null,
        runtimeState: data?.runtimeState && typeof data.runtimeState === 'object' ? data.runtimeState as AIRuntimeState : null,
    }
}

function emptyWorkspace(authStatus: 'unauthorized' | 'unavailable'): AIWorkspaceBundle {
    return {
        authStatus,
        conversations: [],
        repositories: [],
        deployments: [],
        releases: [],
        deployQuota: null,
        ownershipSummary: null,
        runtimeState: null,
    }
}
