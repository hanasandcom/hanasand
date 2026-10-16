import { useMemo } from 'react'
import { chooseNewestFailure, chooseNewestToolRun, deriveLastFailure, deriveLastToolState } from './runtimeState'
import { useConversationActions } from './useConversationActions'
import type { WorkbenchState } from './useWorkbenchState'

export function useConversationView(state: WorkbenchState, createNewConversation: () => Promise<void>) {
    const {
        conversations, search, activeConversationId, isAuthenticated, setConversations,
        setActiveConversationId, setStatusNotice, shareTrees, shareFileContents, shareContents,
        clients, runtimeSnapshot, participants, statusNotice,
    } = state
    const filteredConversations = useMemo(() => {
        const query = search.trim().toLowerCase()
        return conversations.filter((conversation) => !conversation.archivedAt && matchesQuery(conversation, query))
    }, [conversations, search])
    const archivedConversations = useMemo(() => {
        const query = search.trim().toLowerCase()
        return conversations.filter((conversation) => Boolean(conversation.archivedAt) && matchesQuery(conversation, query))
    }, [conversations, search])
    const resolvedActiveConversationId = useMemo(() => {
        if (activeConversationId && conversations.some((conversation) => conversation.id === activeConversationId)) {
            return activeConversationId
        }
        return conversations.find((conversation) => !conversation.archivedAt)?.id || conversations[0]?.id || null
    }, [activeConversationId, conversations])
    const actions = useConversationActions({
        conversations,
        isAuthenticated,
        resolvedActiveConversationId,
        setConversations,
        setActiveConversationId,
        setStatusNotice,
        createConversationFallback: createNewConversation,
    })
    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === resolvedActiveConversationId) || null,
        [resolvedActiveConversationId, conversations]
    )
    const selectedRepoFilePath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
        ? activeConversation.workspaceMeta.selectedFilePath
        : null
    const activeWorkspaceId = activeConversation?.workspaceId || null
    const activeShareTree = activeWorkspaceId ? shareTrees[activeWorkspaceId] || null : null
    const selectedShareFileContent = activeWorkspaceId && selectedRepoFilePath
        ? shareFileContents[`${activeWorkspaceId}:${selectedRepoFilePath}`] || null
        : null
    const selectedShareContent = activeWorkspaceId ? shareContents[activeWorkspaceId] || null : null
    const runtimeState = useMemo<AIRuntimeState>(() => {
        const localLastToolRun = deriveLastToolState(conversations)
        const localLastFailure = deriveLastFailure(conversations, statusNotice)
        const connectedClientCount = clients.length || runtimeSnapshot?.connectedClientCount || participants
        return {
            status: statusNotice
                ? 'error'
                : clients.some((client) => client.model.status === 'generating')
                    ? 'generating'
                    : clients.some((client) => client.model.status === 'preparing')
                        ? 'preparing'
                        : clients.some((client) => client.model.status === 'error')
                            ? 'error'
                            : connectedClientCount
                                ? 'idle'
                                : (runtimeSnapshot?.status || 'offline'),
            connectedClientCount,
            connectedModelNames: clients.length ? clients.map((client) => client.name) : (runtimeSnapshot?.connectedModelNames || []),
            activeConversationId: activeConversation?.id || runtimeSnapshot?.activeConversationId || null,
            activeWorkspace: {
                conversationId: activeConversation?.id || runtimeSnapshot?.activeWorkspace.conversationId || null,
                workspaceId: activeConversation?.workspaceId || runtimeSnapshot?.activeWorkspace.workspaceId || null,
                workspaceKind: activeConversation?.workspaceKind || runtimeSnapshot?.activeWorkspace.workspaceKind || null,
                shareIds: activeConversation?.shareIds || runtimeSnapshot?.activeWorkspace.shareIds || [],
                workspaceMeta: activeConversation?.workspaceMeta || runtimeSnapshot?.activeWorkspace.workspaceMeta || {},
            },
            lastToolRun: chooseNewestToolRun(runtimeSnapshot?.lastToolRun || null, localLastToolRun),
            lastFailure: chooseNewestFailure(runtimeSnapshot?.lastFailure || null, localLastFailure),
            lastUpdatedAt: [activeConversation?.updatedAt || null, localLastToolRun?.updatedAt || null,
                localLastFailure?.updatedAt || null, runtimeSnapshot?.lastUpdatedAt || null,
                clients.find((client) => client.model.lastUpdated)?.model.lastUpdated || null]
                .find((value) => typeof value === 'string') || null,
        }
    }, [activeConversation, clients, conversations, participants, runtimeSnapshot, statusNotice])

    return {
        ...actions,
        filteredConversations,
        archivedConversations,
        resolvedActiveConversationId,
        activeConversation,
        selectedRepoFilePath,
        activeShareTree,
        selectedShareFileContent,
        selectedShareContent,
        runtimeState,
    }
}

function matchesQuery(conversation: AIConversation, query: string) {
    return !query || conversation.title.toLowerCase().includes(query)
        || conversation.messages.some((message) => message.content.toLowerCase().includes(query))
        || (conversation.preferredModel || '').toLowerCase().includes(query)
}
