import { useEffect } from 'react'
import normalizeClient from '@/components/gpt/normalizeClient'
import { appendError, findLatestAssistantIndex } from './conversationModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useSocketMessageHandler(
    state: WorkbenchState,
    persistAssistantMessageFromEvent: (message: GptSocketMessage) => Promise<void>
) {
    const { handleSocketMessageRef, setParticipants, setClients, setConversations, conversationsRef } = state
    useEffect(() => {
        handleSocketMessageRef.current = (message: GptSocketMessage) => {
            if (message.type === 'join') {
                setParticipants(message.participants || 0)
                return
            }
            if (message.type === 'snapshot') {
                const normalized = (message.clients || []).map(normalizeClient)
                setParticipants(message.participants || normalized.length)
                setClients(normalized)
                return
            }
            if (message.type === 'update' && message.client) {
                const normalizedClient = normalizeClient(message.client)
                setParticipants(message.participants || 0)
                setClients((prev) => {
                    const existing = prev.find((client) => client.name === normalizedClient.name)
                    return existing
                        ? prev.map((client) => client.name === normalizedClient.name ? normalizedClient : client)
                        : [...prev, normalizedClient]
                })
                setConversations((prev) => prev.map((conversation) => (
                    conversation.activeModel === normalizedClient.name || conversation.preferredModel === normalizedClient.name
                        ? { ...conversation, metrics: normalizedClient.model }
                        : conversation
                )))
                return
            }
            if (!message.conversationId) return

            setConversations((prev) => {
                const nextConversations = prev.map((conversation) => {
                    if (conversation.id !== message.conversationId) return conversation
                    if (message.type === 'prompt_started') {
                        return {
                            ...conversation,
                            activeModel: message.clientName || conversation.activeModel,
                            updatedAt: new Date().toISOString(),
                            metrics: message.metrics || conversation.metrics,
                        }
                    }
                    if (message.type === 'prompt_tool' && message.toolId && message.toolLabel) {
                        return applyToolProgress(conversation, message)
                    }
                    if (message.type === 'prompt_delta' || message.type === 'prompt_complete') {
                        return applyAssistantProgress(conversation, message)
                    }
                    if (message.type === 'prompt_error') {
                        return appendError(conversation, message.error || 'The model failed to answer this prompt.', message.metrics, message.clientName || conversation.activeModel)
                    }
                    return conversation
                })
                conversationsRef.current = nextConversations
                return nextConversations
            })
            if (message.type === 'prompt_complete' || message.type === 'prompt_error') {
                setTimeout(() => void persistAssistantMessageFromEvent(message), 0)
            }
        }
    }, [conversationsRef, handleSocketMessageRef, persistAssistantMessageFromEvent, setClients, setConversations, setParticipants])
}

function applyToolProgress(conversation: AIConversation, message: GptSocketMessage) {
    const messages = [...conversation.messages]
    const existingIndex = messages.findIndex((entry) => entry.role === 'tool' && entry.metadata?.toolId === message.toolId)
    const toolMessage: AIConversationMessage = {
        id: existingIndex >= 0 ? messages[existingIndex].id : `tool-${message.toolId}`,
        role: 'tool',
        content: message.toolDetail ? `${message.toolLabel}\n\n${message.toolDetail}` : message.toolLabel || '',
        createdAt: existingIndex >= 0 ? messages[existingIndex].createdAt : new Date().toISOString(),
        metadata: { toolId: message.toolId, toolState: message.toolState || 'running', agentTool: true },
    }
    if (existingIndex >= 0) messages[existingIndex] = { ...messages[existingIndex], ...toolMessage }
    else messages.push(toolMessage)
    return { ...conversation, updatedAt: new Date().toISOString(), messages, metrics: message.metrics || conversation.metrics }
}

function applyAssistantProgress(conversation: AIConversation, message: GptSocketMessage) {
    const messages = [...conversation.messages]
    const assistantIndex = findLatestAssistantIndex(messages)
    if (assistantIndex >= 0) {
        const assistant = messages[assistantIndex]
        messages[assistantIndex] = {
            ...assistant,
            modelName: message.clientName || assistant.modelName || conversation.activeModel,
            content: message.content || `${assistant.content}${message.delta || ''}`,
            pending: message.type === 'prompt_delta',
            metadata: {
                ...(assistant.metadata || {}),
                artifacts: message.artifacts || (assistant.metadata?.artifacts as AIArtifact[] | undefined) || [],
            },
        }
    } else if (message.type === 'prompt_complete') {
        messages.push({
            id: `${conversation.id}-assistant-${Date.now()}`,
            role: 'assistant',
            content: message.content || '',
            pending: false,
            createdAt: new Date().toISOString(),
            modelName: message.clientName || conversation.activeModel,
            metadata: { artifacts: message.artifacts || [] },
        })
    }
    return {
        ...conversation,
        updatedAt: new Date().toISOString(),
        activeModel: message.clientName || conversation.activeModel,
        metrics: message.metrics || conversation.metrics,
        messages,
    }
}
