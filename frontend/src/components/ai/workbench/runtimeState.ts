'use client'

export function deriveLastToolState(conversations: AIConversation[]): AIRuntimeToolRun | null {
    const lastToolMessage = [...conversations]
        .flatMap((conversation) => conversation.messages.map((message) => ({ conversation, message })))
        .filter((entry) => entry.message.role === 'tool')
        .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime())[0] || null

    if (!lastToolMessage) {
        return null
    }

    return {
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
        updatedAt: lastToolMessage.message.createdAt || new Date().toISOString(),
    }
}

export function deriveLastFailure(
    conversations: AIConversation[],
    statusNotice: string | null,
): AIRuntimeFailure | null {
    const lastFailure = [...conversations]
        .flatMap((conversation) => conversation.messages.map((message) => ({ conversation, message })))
        .filter((entry) => entry.message.error)
        .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime())[0] || null

    if (lastFailure) {
        return {
            message: lastFailure.message.content,
            conversationId: lastFailure.conversation.id,
            updatedAt: lastFailure.message.createdAt,
            source: lastFailure.message.role === 'tool' ? 'tool' : 'conversation',
        }
    }

    if (!statusNotice) {
        return null
    }

    return {
        message: statusNotice,
        conversationId: null,
        updatedAt: new Date().toISOString(),
        source: 'conversation',
    }
}

export function chooseNewestToolRun(serverToolRun: AIRuntimeToolRun | null, localToolRun: AIRuntimeToolRun | null) {
    if (!serverToolRun) return localToolRun
    if (!localToolRun) return serverToolRun

    return new Date(localToolRun.updatedAt).getTime() >= new Date(serverToolRun.updatedAt).getTime()
        ? localToolRun
        : serverToolRun
}

export function chooseNewestFailure(serverFailure: AIRuntimeFailure | null, localFailure: AIRuntimeFailure | null) {
    if (!serverFailure) return localFailure
    if (!localFailure) return serverFailure

    return new Date(localFailure.updatedAt).getTime() >= new Date(serverFailure.updatedAt).getTime()
        ? localFailure
        : serverFailure
}
