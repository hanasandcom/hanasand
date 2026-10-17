'use client'

import defaultModelMetrics from '@/components/gpt/defaultModelMetrics'
import { getCookie } from '@/utils/cookies/cookies'

export function createConversation(clientName: string | null = null): AIConversation {
    const timestamp = new Date().toISOString()
    return {
        id: crypto.randomUUID(),
        ownerId: getCookie('id') || '',
        title: 'Review assistant',
        preferredModel: clientName,
        activeModel: clientName,
        modelStrategy: 'auto',
        workspaceId: null,
        workspaceKind: null,
        shareIds: [],
        workspaceMeta: {},
        messages: [],
        collaboration: {
            role: 'owner',
            canInvite: true,
            seatLimit: 5,
            seatCount: 0,
            remainingSeats: 5,
            collaborators: [],
        },
        metrics: defaultModelMetrics(),
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}

export function appendError(
    conversation: AIConversation,
    content: string,
    metrics?: GPT_ModelMetrics,
    modelName?: string | null,
): AIConversation {
    const messages = [...conversation.messages]
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.pending) {
        messages[messages.length - 1] = { ...lastMessage, content, pending: false, error: true, modelName: modelName || lastMessage.modelName || null }
    } else {
        messages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            error: true,
            createdAt: new Date().toISOString(),
            modelName: modelName || null,
        })
    }

    return {
        ...conversation,
        updatedAt: new Date().toISOString(),
        metrics: metrics || { ...conversation.metrics, status: 'error', lastError: content },
        messages,
    }
}

export function resolveModelName(conversation: AIConversation, clients: GPT_Client[]) {
    const names = clients.map((client) => client.name)
    return [conversation.preferredModel, conversation.activeModel, names[0]].find((name) => name && names.includes(name)) || null
}

export function toConversationPayload(conversation: Partial<AIConversation>) {
    return {
        id: conversation.id,
        title: conversation.title,
        preferredModel: conversation.preferredModel ?? null,
        activeModel: conversation.activeModel ?? null,
        modelStrategy: conversation.modelStrategy ?? 'auto',
        workspaceKind: conversation.workspaceKind ?? null,
        workspaceId: conversation.workspaceId ?? null,
        shareIds: conversation.shareIds ?? [],
        workspaceMeta: conversation.workspaceMeta ?? {},
        archivedAt: conversation.archivedAt ?? null,
    }
}

export function findLatestAssistantIndex(messages: AIConversationMessage[]) {
    for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index]?.role === 'assistant') return index
    }
    return -1
}

export function updateConversationState(
    conversationsRef: { current: AIConversation[] },
    setConversations: React.Dispatch<React.SetStateAction<AIConversation[]>>,
    update: (conversations: AIConversation[]) => AIConversation[],
) {
    setConversations((current) => {
        const next = update(current)
        conversationsRef.current = next
        return next
    })
}
