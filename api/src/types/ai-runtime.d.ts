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
    workspaceKind: 'share' | 'repo' | null
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
