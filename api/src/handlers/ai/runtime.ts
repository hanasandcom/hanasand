type RuntimeConversation = {
    id: string
    workspaceId: string | null
    workspaceKind: 'share' | 'repo' | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
    archivedAt?: string | null
    updatedAt: string
    messages: Array<{
        role: 'user' | 'assistant' | 'tool'
        content: string
        error?: boolean
        metadata?: Record<string, unknown>
        createdAt: string
    }>
}

type BuildAiRuntimeStateInput = {
    conversations?: RuntimeConversation[]
    clients?: GPT_Client[]
    participants?: number
}

type RuntimeMessageEntry = {
    conversation: RuntimeConversation
    message: RuntimeConversation['messages'][number]
    timestamp: number
}

function findLatestRuntimeMessages(conversations: RuntimeConversation[]) {
    let lastToolMessage: RuntimeMessageEntry | null = null
    let lastFailure: RuntimeMessageEntry | null = null

    for (const conversation of conversations) {
        for (const message of conversation.messages) {
            const entry = {
                conversation,
                message,
                timestamp: new Date(message.createdAt).getTime(),
            }

            if (message.role === 'tool' && (!lastToolMessage || entry.timestamp > lastToolMessage.timestamp)) {
                lastToolMessage = entry
            }
            if (message.error && (!lastFailure || entry.timestamp > lastFailure.timestamp)) {
                lastFailure = entry
            }
        }
    }

    return { lastToolMessage, lastFailure }
}

export function buildAiRuntimeState({
    conversations = [],
    clients = [],
    participants = 0,
}: BuildAiRuntimeStateInput): AIRuntimeState {
    const activeConversation = conversations.find((conversation) => !conversation.archivedAt) || conversations[0] || null
    const { lastToolMessage, lastFailure } = findLatestRuntimeMessages(conversations)

    const status: AIRuntimeStatus = lastFailure
        ? 'error'
        : clients.some((client) => client.model.status === 'generating')
            ? 'generating'
            : clients.some((client) => client.model.status === 'preparing')
                ? 'preparing'
                : clients.some((client) => client.model.status === 'error')
                    ? 'error'
                    : clients.length
                        ? 'idle'
                        : 'offline'

    return {
        status,
        connectedClientCount: clients.length || participants,
        connectedModelNames: clients.map((client) => client.name),
        activeConversationId: activeConversation?.id || null,
        activeWorkspace: {
            conversationId: activeConversation?.id || null,
            workspaceId: activeConversation?.workspaceId || null,
            workspaceKind: activeConversation?.workspaceKind || null,
            shareIds: activeConversation?.shareIds || [],
            workspaceMeta: activeConversation?.workspaceMeta || {},
        },
        lastToolRun: lastToolMessage ? {
            conversationId: lastToolMessage.conversation.id || null,
            label: typeof lastToolMessage.message.metadata?.tool === 'string'
                ? lastToolMessage.message.metadata.tool
                : typeof lastToolMessage.message.metadata?.toolId === 'string'
                    ? lastToolMessage.message.metadata.toolId
                    : 'tool',
            detail: lastToolMessage.message.content || null,
            state: lastToolMessage.message.error
                ? 'error'
                : typeof lastToolMessage.message.metadata?.toolState === 'string'
                    ? lastToolMessage.message.metadata.toolState as AIRuntimeToolState
                    : 'completed',
            updatedAt: lastToolMessage.message.createdAt,
        } : null,
        lastFailure: lastFailure ? {
            source: lastFailure.message.role === 'tool' ? 'tool' : 'conversation',
            message: lastFailure.message.content,
            conversationId: lastFailure.conversation.id,
            updatedAt: lastFailure.message.createdAt,
        } : null,
        lastUpdatedAt: [
            activeConversation?.updatedAt || null,
            lastToolMessage?.message.createdAt || null,
            lastFailure?.message.createdAt || null,
            ...clients.map((client) => client.model.lastUpdated || null),
        ].find((value) => typeof value === 'string') || null,
    }
}
