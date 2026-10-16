import { useCallback } from 'react'
import { appendError, buildSystemPrompt, buildWorkspaceContext, resolveModelName } from './helpers'
import type { WorkbenchState } from './useWorkbenchState'

export function usePromptActions(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    patchConversation: (id: string, patch: Partial<AIConversation>) => Promise<void>,
    persistMessage: (conversationId: string, message: AIConversationMessage) => Promise<void>
) {
    const {
        composer, setComposer, clients, socketRef, setConversations, conversationsRef,
        importedRepos, shareContents, shareTrees, shareFileContents, setStatusNotice,
    } = state

    const setPreferredModel = useCallback(async (preferredModel: string | null) => {
        if (!activeConversation) return
        await patchConversation(activeConversation.id, { preferredModel })
    }, [activeConversation, patchConversation])

    const setModelStrategy = useCallback(async (modelStrategy: 'auto' | 'pinned') => {
        if (!activeConversation) return
        await patchConversation(activeConversation.id, { modelStrategy })
    }, [activeConversation, patchConversation])

    const sendPrompt = useCallback(async () => {
        const prompt = composer.trim()
        if (!prompt || !activeConversation) return
        if (activeConversation.messages.at(-1)?.pending) {
            setStatusNotice('Wait for the current response to finish before sending another prompt.')
            return
        }
        const socket = socketRef.current
        const resolvedModel = resolveModelName(activeConversation, clients)
        if (!socket || socket.readyState !== WebSocket.OPEN || !resolvedModel) {
            setConversations((prev) => prev.map((conversation) => conversation.id === activeConversation.id
                ? appendError(conversation, 'No live model client is connected.')
                : conversation))
            return
        }
        const userMessage: AIConversationMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: prompt,
            createdAt: new Date().toISOString(),
            modelName: resolvedModel,
        }
        const assistantMessage: AIConversationMessage = {
            id: `${activeConversation.id}-assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            pending: true,
            createdAt: new Date().toISOString(),
            modelName: resolvedModel,
        }
        const workspaceContext = await buildWorkspaceContext(
            activeConversation, importedRepos, shareContents, shareTrees, shareFileContents
        )
        const messages = [
            { role: 'system' as const, content: buildSystemPrompt({ conversation: activeConversation, workspaceContext }) },
            ...activeConversation.messages
                .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'tool')
                .map((message) => ({
                    role: message.role === 'tool' ? 'assistant' as const : message.role,
                    content: message.content,
                })),
            { role: 'user' as const, content: prompt },
        ]
        const optimisticUpdatedAt = new Date().toISOString()
        const optimisticTitle = activeConversation.messages.length ? activeConversation.title : prompt.slice(0, 72)
        const optimisticConversation: AIConversation = {
            ...activeConversation,
            activeModel: resolvedModel,
            title: optimisticTitle,
            updatedAt: optimisticUpdatedAt,
            messages: [...activeConversation.messages, userMessage, assistantMessage],
        }
        conversationsRef.current = conversationsRef.current.map((conversation) => (
            conversation.id === activeConversation.id ? optimisticConversation : conversation
        ))
        setConversations((prev) => {
            const next = prev.map((conversation) => conversation.id === activeConversation.id
                ? { ...conversation, activeModel: resolvedModel, title: conversation.messages.length ? conversation.title : prompt.slice(0, 72),
                    updatedAt: optimisticUpdatedAt, messages: [...conversation.messages, userMessage, assistantMessage] }
                : conversation)
            conversationsRef.current = next
            return next
        })
        setComposer('')
        socket.send(JSON.stringify({
            type: 'prompt_request',
            conversationId: activeConversation.id,
            clientName: resolvedModel,
            messages,
            maxTokens: 1024,
            temperature: 0.35,
        }))
        void Promise.all([
            patchConversation(activeConversation.id, { activeModel: resolvedModel, title: optimisticTitle }),
            persistMessage(activeConversation.id, userMessage),
            persistMessage(activeConversation.id, assistantMessage),
        ]).catch(() => {
            setStatusNotice('Chat history is syncing slowly. The live response was still sent to the model.')
        })
    }, [activeConversation, composer, clients, importedRepos, patchConversation, persistMessage,
        setComposer, setConversations, setStatusNotice, shareContents, shareFileContents, shareTrees,
        socketRef, conversationsRef])

    return { setPreferredModel, setModelStrategy, sendPrompt }
}
