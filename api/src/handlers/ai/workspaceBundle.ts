import { listGptClients, gpt } from '#utils/ws/handleGptMessage.ts'
import { buildAiRuntimeState } from './runtime.ts'
import { toRepoCredentialSummary } from '#utils/ai/repoCredentials.ts'
import { getDeployQuota, toDeployment, type DeploymentRow } from './deploymentShared.ts'
import { toReleaseBase, type ReleaseRow } from './releaseShared.ts'
import {
    queryAccessibleCollaborators,
    queryAccessibleConversations,
    queryAccessibleDeployments,
    queryAccessibleMessages,
    queryAccessibleReleases,
    queryAccessibleRepositories,
    queryAccessibleRepositoryFiles,
    queryAccessibleUsageEvents,
    queryVmOwnership,
} from './workspaceQueries.ts'
import type {
    AiConversationRow,
    AiMessageRow,
    CollaborationRow,
    UsageRow,
    VmOwnershipRow,
    WorkspaceRepositoryFileRow,
    WorkspaceRepositoryRow,
} from './workspaceTypes.ts'
import { summarizeOwnership, toAiConversation, toUsageEvent } from './workspaceProjection.ts'

export async function getConversationForUser(conversationId: string, ownerId: string) {
    const result = await queryAccessibleConversations(ownerId, conversationId)

    return (result.rows as AiConversationRow[])[0] || null
}

export async function getConversationBundleForUser(ownerId: string, conversationId: string) {
    const [conversationResult, messageResult, collaboratorResult] = await Promise.all([
        queryAccessibleConversations(ownerId, conversationId),
        queryAccessibleMessages(ownerId, conversationId),
        queryAccessibleCollaborators(ownerId, conversationId),
    ])
    const conversation = (conversationResult.rows as AiConversationRow[])[0]
    if (!conversation) return null

    return toAiConversation(
        conversation,
        messageResult.rows as AiMessageRow[],
        collaboratorResult.rows as CollaborationRow[],
    )
}

export async function getWorkspaceBundle(ownerId: string) {
    const [conversationResult, messageResult, repositoryResult, fileResult, deploymentResult, collaborationResult, releaseResult, usageResult] = await Promise.all([
        queryAccessibleConversations(ownerId),
        queryAccessibleMessages(ownerId),
        queryAccessibleRepositories(ownerId),
        queryAccessibleRepositoryFiles(ownerId),
        queryAccessibleDeployments(ownerId),
        queryAccessibleCollaborators(ownerId),
        queryAccessibleReleases(ownerId),
        queryAccessibleUsageEvents(ownerId),
    ])

    const conversations = conversationResult.rows as AiConversationRow[]
    const messages = messageResult.rows as AiMessageRow[]
    const repositories = repositoryResult.rows as WorkspaceRepositoryRow[]
    const files = fileResult.rows as WorkspaceRepositoryFileRow[]
    const usage = usageResult.rows as UsageRow[]

    const messagesByConversation = new Map<string, AiMessageRow[]>()
    for (const message of messages) {
        const bucket = messagesByConversation.get(message.conversation_id) || []
        bucket.push(message)
        messagesByConversation.set(message.conversation_id, bucket)
    }

    const filesByRepository = new Map<string, { path: string, name: string, content: string }[]>()
    for (const file of files) {
        const bucket = filesByRepository.get(file.repository_id) || []
        bucket.push({ path: file.path, name: file.name, content: file.content })
        filesByRepository.set(file.repository_id, bucket)
    }

    const collaboratorsByConversation = new Map<string, CollaborationRow[]>()
    for (const collaborator of collaborationResult.rows as CollaborationRow[]) {
        const bucket = collaboratorsByConversation.get(collaborator.conversation_id) || []
        bucket.push(collaborator)
        collaboratorsByConversation.set(collaborator.conversation_id, bucket)
    }

    const normalizedConversations = conversations.map((conversation) =>
        toAiConversation(conversation, messagesByConversation.get(conversation.id) || [], collaboratorsByConversation.get(conversation.id) || [])
    )
    const normalizedReleases = (releaseResult.rows as ReleaseRow[]).map(toReleaseBase)
    const normalizedDeployments = (deploymentResult.rows as DeploymentRow[]).map(toDeployment)
    const normalizedUsage = usage.map(toUsageEvent)
    const vmNames = Array.from(new Set([...normalizedDeployments.map((deployment) => deployment.vmName), ...normalizedReleases.map((release) => release.vmName)].filter(Boolean)))
    const vmOwnershipResult = vmNames.length ? await queryVmOwnership(vmNames) : { rows: [] }
    const vmOwnership = vmOwnershipResult.rows as VmOwnershipRow[]

    return {
        conversations: normalizedConversations,
        repositories: repositories.map((repository) => ({
            id: repository.id,
            ownerId: repository.owner_id,
            accessScope: repository.owner_id === ownerId ? 'owned' : 'shared_conversation',
            name: repository.name,
            fullName: repository.full_name,
            branch: repository.branch,
            defaultBranch: repository.default_branch,
            sourcePath: repository.source_path,
            sourceUrl: repository.source_url,
            authMode: repository.auth_mode || 'public',
            authHint: repository.auth_hint,
            syncStatus: repository.sync_status || 'ready',
            lastSyncedAt: repository.last_synced_at,
            lastSyncError: repository.last_sync_error,
            syncHistory: Array.isArray(repository.sync_history) ? repository.sync_history : [],
            stackType: repository.stack_type || 'unknown',
            stackReason: repository.stack_reason,
            stackSupported: (repository.stack_type || 'unknown') !== 'unknown',
            credential: toRepoCredentialSummary({
                github_token_encrypted: repository.github_token_encrypted,
                github_token_hint: repository.github_token_hint,
                github_token_attached_at: repository.github_token_attached_at,
                github_token_last_used_at: repository.github_token_last_used_at,
                github_token_last_validated_at: repository.github_token_last_validated_at,
            }),
            truncated: repository.truncated,
            importedAt: repository.imported_at,
            files: filesByRepository.get(repository.id) || [],
        })),
        deployments: normalizedDeployments,
        releases: normalizedReleases,
        deployQuota: await getDeployQuota(ownerId),
        ownershipSummary: summarizeOwnership({
            currentUserId: ownerId,
            conversations,
            repositories,
            releases: normalizedReleases,
            deployments: normalizedDeployments,
            vmOwnership,
            collaborators: collaboratorsByConversation,
            usage: normalizedUsage,
        }),
        runtimeState: buildAiRuntimeState({
            conversations: normalizedConversations,
            clients: listGptClients('gpt'),
            participants: gpt.get('gpt')?.size || 0,
        }),
    }
}
