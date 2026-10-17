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
