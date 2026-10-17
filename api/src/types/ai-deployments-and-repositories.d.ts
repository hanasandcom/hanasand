type AIDeploymentStatus = 'planned' | 'syncing' | 'building' | 'running' | 'healthchecking' | 'blocked' | 'failed'

type AIDeploymentStage = 'planned' | 'sync_access' | 'clone' | 'sync' | 'install' | 'build' | 'run' | 'healthcheck' | 'healthcheck_failed' | 'blocked' | 'manual_step_required'

type AIDeploymentEvent = {
    stage: AIDeploymentStage
    message: string
    timestamp: string
}

type AIDeployment = {
    id: string
    ownerId: string
    conversationId: string
    repositoryId: string | null
    workspaceKind: 'share' | 'repo' | null
    workspaceId: string | null
    vmName: string
    serviceName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    startedBy: string | null
    status: AIDeploymentStatus
    previewUrl: string | null
    healthcheckUrl: string | null
    events: AIDeploymentEvent[]
    failureReason: string | null
    createdAt: string
    updatedAt: string
    completedAt: string | null
}

type AIUsageEventKind =
    | 'conversation_created'
    | 'message_written'
    | 'ai_run_completed'
    | 'ai_run_failed'
    | 'ai_run_platform_error'
    | 'browser_proof_completed'
    | 'build_minutes_recorded'
    | 'deploy_minutes_recorded'
    | 'cache_hit'
    | 'deployment_started'
    | 'release_recorded'
    | 'rollback_marked'
    | 'collaborator_invited'
    | 'collaborator_removed'

type AIArtifact = {
    kind: 'screenshot' | 'log' | 'command' | 'http' | 'file' | 'link' | 'diff'
    title: string
    path?: string | null
    url?: string | null
    content?: string | null
    language?: string | null
    dataUrl?: string | null
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
    truncated: boolean
    importedAt: string
    credential: AIRepositoryCredentialSummary
    files: AIImportedRepoFile[]
}

type AIStackType = 'nextjs_docker' | 'fastify_postgres' | 'fastify_worker_redis' | 'unknown'

type AIDeploymentAccessPolicy = 'owner_only' | 'collaborators' | 'public_preview'

type AIReleaseStatus = 'current' | 'superseded' | 'failed' | 'rollback_target' | 'rolled_back' | 'restored_source'

type AIRelease = {
    id: string
    ownerId: string
    conversationId: string
    deploymentId: string | null
    vmName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    previewUrl: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    notes: string | null
    trust?: AIReleaseTrust
}

