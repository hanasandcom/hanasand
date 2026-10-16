type AIWorkspaceKind = 'share' | 'repo'

type AIConversationMessage = {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    pending?: boolean
    error?: boolean
    modelName?: string | null
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt?: string
}

type AIArtifact = {
    kind: 'screenshot' | 'log' | 'command' | 'http' | 'file' | 'link' | 'diff'
    title: string
    path?: string | null
    url?: string | null
    content?: string | null
    language?: string | null
    dataUrl?: string | null
}

type AIConversation = {
    id: string
    ownerId: string
    title: string
    preferredModel: string | null
    activeModel: string | null
    modelStrategy: 'auto' | 'pinned'
    workspaceId: string | null
    workspaceKind: AIWorkspaceKind | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
    messages: AIConversationMessage[]
    collaboration: AIConversationCollaboration
    metrics: GPT_ModelMetrics
    archivedAt?: string | null
    createdAt: string
    updatedAt: string
}

type AIConversationCollaboration = {
    role: 'owner' | 'reviewer' | 'editor'
    canInvite: boolean
    seatLimit: number
    seatCount: number
    remainingSeats: number
    collaborators: AIConversationCollaborator[]
}

type AIConversationCollaborator = {
    userId: string
    name: string | null
    avatar: string | null
    role: 'reviewer' | 'editor'
    invitedBy: string | null
    createdAt: string
}

type AIStackType = 'nextjs_docker' | 'fastify_postgres' | 'fastify_worker_redis' | 'unknown'

type AIDeploymentAccessPolicy = 'owner_only' | 'collaborators' | 'public_preview'

type AIDeploymentEnvironment = 'staging' | 'production'

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

type AIReleaseTrust = {
    versionHistory: {
        releaseId: string
        status: AIReleaseStatus
        createdAt: string
        updatedAt: string
        summary: string
    }
    recovery: {
        rollbackAvailable: boolean
        rollbackLabel: string
        backupBeforeRiskyChanges: boolean
        backupPolicy: string
    }
    exports: {
        zipAvailable: boolean
        githubAvailable: boolean
        zipLabel: string
        githubLabel: string
    }
    launchReport: string[]
    noLockIn: {
        headline: string
        bullets: string[]
    }
    supportBundle: {
        available: boolean
        url: string
        includes: string[]
        requestIds: string[]
    }
    sla: {
        tier: string
        promise: string
    }[]
}
