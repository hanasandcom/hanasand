type AIWorkspaceBundle = {
    authStatus: 'ready' | 'unauthenticated' | 'unauthorized' | 'unavailable'
    conversations: AIConversation[]
    repositories: AIImportedRepo[]
    deployments: AIDeployment[]
    releases: AIRelease[]
    deployQuota: AIDeployQuota | null
    ownershipSummary: AIOwnershipSummary | null
    runtimeState: AIRuntimeState | null
}

type AIImportedRepoFile = {
    path: string
    name: string
    content: string
}

type AISyncProgress = {
    syncedFiles: number
    totalFiles: number
    currentPath: string | null
}

type AIRepositorySyncEvent = {
    timestamp: string
    status: 'ready' | 'syncing' | 'error'
    source: 'import' | 'refresh' | 'sync'
    message: string
}

type AIImportedRepo = {
    id: string
    ownerId: string
    accessScope: 'owned' | 'shared_conversation'
    name: string
    fullName: string
    branch: string
    defaultBranch: string
    sourcePath: string
    sourceUrl: string
    authMode: 'public' | 'github_token'
    authHint: string | null
    syncStatus: 'ready' | 'syncing' | 'error'
    lastSyncedAt: string | null
    lastSyncError: string | null
    syncHistory: AIRepositorySyncEvent[]
    stackType: AIStackType
    stackReason: string | null
    stackSupported: boolean
    files: AIImportedRepoFile[]
    truncated: boolean
    importedAt: string
    credential: AIRepositoryCredentialSummary
}

type AIRepositoryCredentialSummary = {
    provider: 'github_pat'
    hasCredential: boolean
    tokenHint: string | null
    attachedAt: string | null
    lastUsedAt: string | null
    lastValidatedAt: string | null
}

type AIGitStatusFile = {
    path: string
    index: string
    workingTree: string
    selected: boolean
}

type AIGitStatus = {
    files: AIGitStatusFile[]
    branchSummary: string | null
}
