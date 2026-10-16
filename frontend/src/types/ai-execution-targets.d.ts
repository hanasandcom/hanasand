type VMConnectionDetails = {
    vmName: string
    vmIp: string
    username: string
    sshCommand: string | null
    certificateCount: number
    certificates: Certificate[]
}

type AgentVmMissingCapability = {
    key: 'remote_command_execution' | 'remote_file_write' | 'remote_terminal_stream' | 'remote_repo_sync'
    reason: string
}

type AgentVmTarget = {
    id: string
    name: string
    owner: string
    createdBy: string
    accessUsers: string[]
    status: string
    type: string
    architecture: string
    imageDescription: string
    createdAt: string
    lastUsedAt: string
    lastCheckedAt: string
    network: {
        ipv4: string
        sshHost: string | null
        sshUser: string
    }
    resources: {
        cpu: string
        memory: string
    }
    capabilities: {
        canView: boolean
        canConnect: boolean
        canManage: boolean
        canSyncAuthorizedKeys: boolean
        canExecuteRemoteCommands: boolean
        canWriteRemoteFiles: boolean
        supportedActions: Array<'start' | 'stop' | 'restart'>
        supportedConnectionMethods: Array<'ssh'>
        missingCapabilities: AgentVmMissingCapability[]
    }
    endpoints: {
        summary: string
        details: string
        connection: string
        syncAuthorizedKeys: string
        request: string
        actions: Partial<Record<'start' | 'stop' | 'restart', string>>
    }
    suggestedFlow: {
        selection: 'vm' | 'unavailable'
        connect: string | null
        prerequisites: string[]
        notes: string[]
    }
}

type AgentExecutionTarget = {
    id: string
    label: string
    kind: 'local_workspace' | 'vm'
    transport: 'local_process' | 'hanasand_vm_api'
    summary: string
    readiness: 'ready' | 'partial'
    trustBoundary: 'local' | 'remote'
    target: AgentVmTarget | {
        kind: 'local_workspace'
        supportedWorkspaceKinds: Array<'share' | 'repo'>
        supportedOperations: string[]
        missingCapabilities: string[]
    }
}

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
    workspaceKind: AIWorkspaceKind | null
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

type AIDeployQuota = {
    used: number
    limit: number
    remaining: number
    windowMinutes: number
    resetsAt: string
    activeRunning: number
    maxRunning: number
    runningRemaining: number
    sharedAcrossCollaborators: boolean
}
