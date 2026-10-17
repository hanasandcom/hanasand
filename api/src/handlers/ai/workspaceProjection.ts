import type { AiConversationRow, AiMessageRow, CollaborationRow, UsageRow, VmOwnershipRow } from './workspaceTypes.ts'

export function toAiConversation(conversation: AiConversationRow, messages: AiMessageRow[] = [], collaborators: CollaborationRow[] = []) {
    return {
        id: conversation.id,
        ownerId: conversation.owner_id,
        title: conversation.title,
        preferredModel: conversation.preferred_model,
        activeModel: conversation.active_model,
        modelStrategy: conversation.model_strategy,
        workspaceId: conversation.workspace_id,
        workspaceKind: conversation.workspace_kind,
        shareIds: conversation.share_ids || [],
        workspaceMeta: conversation.workspace_meta || {},
        archivedAt: conversation.archived_at,
        collaboration: {
            role: conversation.access_role || 'owner',
            canInvite: (conversation.access_role || 'owner') === 'owner',
            seatLimit: 5,
            seatCount: collaborators.length,
            remainingSeats: Math.max(5 - collaborators.length, 0),
            collaborators: collaborators.map((collaborator) => ({
                userId: collaborator.user_id,
                name: collaborator.user_name,
                avatar: collaborator.user_avatar,
                role: collaborator.role,
                invitedBy: collaborator.invited_by,
                createdAt: collaborator.created_at,
            })),
        },
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            pending: message.pending,
            error: message.error,
            modelName: message.model_name,
            metadata: message.metadata || {},
            createdAt: message.created_at,
            updatedAt: message.updated_at,
        })),
    }
}

export function toUsageEvent(row: UsageRow): AIUsageEvent {
    return {
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        actorId: row.actor_id,
        actorName: row.actor_name,
        conversationId: row.conversation_id,
        deploymentId: row.deployment_id,
        releaseId: row.release_id,
        kind: row.kind,
        units: Number(row.units || 1),
        billableUnits: Number(row.billable_units || 0),
        estimatedCostNok: Number(row.estimated_cost_nok || 0),
        billingMode: row.billing_mode,
        outcome: row.outcome,
        metadata: row.metadata || {},
        createdAt: row.created_at,
    }
}

export function summarizeOwnership({
    currentUserId,
    conversations,
    repositories,
    deployments,
    releases,
    vmOwnership,
    collaborators,
    usage,
}: {
    currentUserId: string
    conversations: AiConversationRow[]
    repositories: {
        id: string
        owner_id: string
    }[]
    deployments: AIDeployment[]
    releases: AIRelease[]
    vmOwnership: VmOwnershipRow[]
    collaborators: Map<string, CollaborationRow[]>
    usage: AIUsageEvent[]
}): AIOwnershipSummary {
    const ownerIds = new Set<string>()
    const repositoryOwnerIds = new Set<string>()
    const vmOwnerIds = new Set<string>()
    const actorIds = new Set<string>()
    let collaboratorSeatCount = 0

    for (const conversation of conversations) {
        ownerIds.add(conversation.owner_id)
        if (conversation.owner_id === currentUserId) {
            collaboratorSeatCount += collaborators.get(conversation.id)?.length || 0
        }
    }

    for (const repository of repositories) {
        repositoryOwnerIds.add(repository.owner_id)
    }

    for (const vm of vmOwnership) {
        vmOwnerIds.add(vm.owner)
    }

    let usageEventCount24h = 0
    let usageUnitCount24h = 0
    let deploymentEventCount24h = 0
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const event of usage) {
        if (event.actorId) {
            actorIds.add(event.actorId)
        }
        if (Date.parse(event.createdAt) >= cutoff) {
            usageEventCount24h += 1
            usageUnitCount24h += event.units
            if (event.kind === 'deployment_started') {
                deploymentEventCount24h += 1
            }
        }
    }

    const externalRepositoryCount = repositories.filter((repository) => repository.owner_id !== currentUserId).length
    const externalVmCount = vmOwnership.filter((vm) => vm.owner !== currentUserId).length
    const boundaryWarnings: string[] = []

    if (externalRepositoryCount > 0) {
        boundaryWarnings.push(`${externalRepositoryCount} imported repo${externalRepositoryCount === 1 ? '' : 's'} belong to another owner and are visible only through shared AI access.`)
    }

    if (externalVmCount > 0) {
        boundaryWarnings.push(`${externalVmCount} VM target${externalVmCount === 1 ? '' : 's'} run outside the current owner boundary.`)
    }

    if (ownerIds.size > 1) {
        boundaryWarnings.push('This workspace spans multiple conversation owners, so future billing and tenant policies should not assume a single owner.')
    }

    return {
        ownerIds: [...ownerIds],
        repositoryOwnerIds: [...repositoryOwnerIds],
        vmOwnerIds: [...vmOwnerIds],
        ownedConversationCount: conversations.filter((conversation) => conversation.owner_id === currentUserId).length,
        sharedConversationCount: conversations.filter((conversation) => conversation.owner_id !== currentUserId).length,
        collaboratorSeatCount,
        repositoryCount: repositories.length,
        externalRepositoryCount,
        deploymentCount: deployments.length,
        releaseCount: releases.length,
        externalVmCount,
        usageEventCount24h,
        usageUnitCount24h,
        deploymentEventCount24h,
        activeActorCount24h: actorIds.size,
        boundaryWarnings,
        recentUsage: usage.slice(0, 12),
    }
}
