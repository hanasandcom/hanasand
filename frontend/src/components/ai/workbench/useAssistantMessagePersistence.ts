import { useCallback } from 'react'
import { stripToolTags } from './toolTags'
import { findLatestAssistantIndex, updateConversationState } from './conversationModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useAssistantMessagePersistence(
    state: WorkbenchState,
    persistMessage: (conversationId: string, message: AIConversationMessage) => Promise<void>
) {
    const { conversationsRef, setConversations, executeAssistantToolsRef, setStatusNotice } = state
    return useCallback(async (message: GptSocketMessage) => {
        if (message.type !== 'prompt_complete' && message.type !== 'prompt_error') return
        if (!message.conversationId) return
        const conversation = conversationsRef.current.find((entry) => entry.id === message.conversationId)
        if (!conversation) return
        const lastMessage = conversation.messages[findLatestAssistantIndex(conversation.messages)]
        if (!lastMessage) return
        const rawContent = message.type === 'prompt_complete'
            ? (message.content || lastMessage.content)
            : (message.error || lastMessage.content || 'The model failed to answer this prompt.')
        const visibleContent = message.type === 'prompt_complete'
            ? (stripToolTags(rawContent).trim() || rawContent)
            : rawContent
        const assistantMessage: AIConversationMessage = {
            ...lastMessage,
            content: visibleContent,
            pending: false,
            error: message.type === 'prompt_error',
            modelName: message.clientName || lastMessage.modelName || conversation.activeModel,
            metadata: {
                ...(lastMessage.metadata || {}),
                artifacts: message.artifacts || (lastMessage.metadata?.artifacts as AIArtifact[] | undefined) || [],
            },
        }
        updateConversationState(conversationsRef, setConversations, (prev) => prev.map((entry) => {
            if (entry.id !== message.conversationId) return entry
            const messages = [...entry.messages]
            const index = messages.findIndex((item) => item.id === assistantMessage.id)
            if (index >= 0) messages[index] = assistantMessage
            return { ...entry, updatedAt: new Date().toISOString(), messages }
        }))
        if (message.type === 'prompt_complete') {
            void executeAssistantToolsRef.current(conversation, { ...assistantMessage, content: rawContent }).catch(() => {
                setStatusNotice('The model answered, but the local tool run could not be started.')
            })
        }
        void persistMessage(message.conversationId, assistantMessage).catch(() => {
            setStatusNotice('Chat history is syncing slowly. The live response is still available.')
        })
    }, [conversationsRef, executeAssistantToolsRef, persistMessage, setConversations, setStatusNotice])
}
