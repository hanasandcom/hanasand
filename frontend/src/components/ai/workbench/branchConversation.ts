'use client'

import { aiClientRequest } from '@/utils/ai/client'
import { createConversation, toConversationPayload } from './conversationModel'
import type { AssistantProvider } from './providerSelection'

export async function branchConversation(source: AIConversation) {
    const branched = createConversation(source.preferredModel)
    branched.title = `${source.title.trim() || 'New chat'} (branch)`
    branched.activeModel = source.activeModel
    branched.modelStrategy = source.modelStrategy
    branched.workspaceId = source.workspaceId
    branched.workspaceKind = source.workspaceKind
    branched.shareIds = [...source.shareIds]
    branched.workspaceMeta = { ...source.workspaceMeta, branchedFromConversationId: source.id }

    const response = await aiClientRequest('/ai/conversations', {
        method: 'POST',
        body: JSON.stringify(toConversationPayload(branched)),
    })
    if (!response.ok) throw new Error('Couldn’t branch this chat.')

    const messages = source.messages.filter((message) => !message.pending).map((message) => ({
        ...message,
        id: crypto.randomUUID(),
        pending: false,
        createdAt: message.createdAt || new Date().toISOString(),
    }))
    for (const message of messages) {
        const messageResponse = await aiClientRequest(`/ai/conversations/${branched.id}/messages`, {
            method: 'PUT',
            body: JSON.stringify({
                id: message.id,
                role: message.role,
                content: message.content,
                pending: false,
                error: Boolean(message.error),
                modelName: message.modelName || null,
                metadata: message.metadata || {},
                createdAt: message.createdAt,
            }),
        })
        if (!messageResponse.ok) {
            await aiClientRequest(`/ai/conversations/${branched.id}`, { method: 'DELETE' }).catch(() => null)
            throw new Error('Couldn’t copy the full chat history into a new branch.')
        }
    }

    return { ...branched, messages }
}

export async function branchChatWithProvider(
    source: AIConversation,
    provider: AssistantProvider,
    preferences: Record<string, AssistantProvider>,
    setPreferences: (preferences: Record<string, AssistantProvider>) => void,
    setStatusNotice: (notice: string | null) => void,
    navigate: (path: string) => void,
) {
    try {
        setStatusNotice(null)
        const branched = await branchConversation(source)
        const nextPreferences = { ...preferences, [branched.id]: provider }
        setPreferences(nextPreferences)
        try { window.localStorage.setItem('hanasand.ai.provider-by-conversation.v1', JSON.stringify(nextPreferences)) } catch { /* Keep the current-session choice. */ }
        navigate(`/ai/${branched.id}`)
    } catch (error) {
        setStatusNotice(error instanceof Error ? error.message : 'Couldn’t branch this chat.')
    }
}
