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

type AIUsageEvent = {
    ownerId: string
    ownerName: string | null
    actorId: string | null
    actorName: string | null
    conversationId: string | null
    deploymentId: string | null
    releaseId: string | null
    kind: AIUsageEventKind
    units: number
    billableUnits?: number
    estimatedCostNok?: number
    billingMode?: string
    outcome?: string
    metadata: Record<string, unknown>
    createdAt: string
}

type AIOwnershipSummary = {
    ownerIds: string[]
    repositoryOwnerIds: string[]
    vmOwnerIds: string[]
    ownedConversationCount: number
    sharedConversationCount: number
    collaboratorSeatCount: number
    repositoryCount: number
    externalRepositoryCount: number
    deploymentCount: number
    releaseCount: number
    externalVmCount: number
    usageEventCount24h: number
    usageUnitCount24h: number
    deploymentEventCount24h: number
    activeActorCount24h: number
    boundaryWarnings: string[]
    recentUsage: AIUsageEvent[]
}

type AIRuntimeStatus = 'offline' | 'idle' | 'preparing' | 'generating' | 'error'

type AIRuntimeToolState = 'running' | 'completed' | 'error'

type AIRuntimeToolRun = {
    conversationId: string | null
    label: string
    detail: string | null
    state: AIRuntimeToolState
    updatedAt: string
}

type AIRuntimeFailure = {
    source: 'model' | 'tool' | 'conversation'
    message: string
    conversationId: string | null
    updatedAt: string
}

type AIRuntimeWorkspace = {
    conversationId: string | null
    workspaceId: string | null
    workspaceKind: AIWorkspaceKind | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
}

type AIRuntimeState = {
    status: AIRuntimeStatus
    connectedClientCount: number
    connectedModelNames: string[]
    activeConversationId: string | null
    activeWorkspace: AIRuntimeWorkspace
    lastToolRun: AIRuntimeToolRun | null
    lastFailure: AIRuntimeFailure | null
    lastUpdatedAt: string | null
}
