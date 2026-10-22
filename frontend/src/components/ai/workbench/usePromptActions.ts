import { useCallback } from 'react'
import { useRef } from 'react'
import { appendError, buildSystemPrompt, buildWorkspaceContext, resolveModelName } from './helpers'
import { updateConversationState } from './conversationModel'
import type { WorkbenchState } from './useWorkbenchState'
import type { useConversationStartup } from './useConversationStartup'

export function usePromptActions(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    patchConversation: (id: string, patch: Partial<AIConversation>) => Promise<void>,
    persistMessage: (conversationId: string, message: AIConversationMessage) => Promise<void>,
    promotePendingDraft: ReturnType<typeof useConversationStartup>['promotePendingDraft']
) {
    const {
        composer, setComposer, clients, socketRef, setConversations, conversationsRef,
        importedRepos, shareContents, shareTrees, shareFileContents, setStatusNotice,
        pendingConversationDraft, setPendingConversationDraft,
    } = state
    const sendingRef = useRef(false)

    const setPreferredModel = useCallback(async (preferredModel: string | null) => {
        if (!activeConversation) return
        await patchConversation(activeConversation.id, { preferredModel })
    }, [activeConversation, patchConversation])

    const setModelStrategy = useCallback(async (modelStrategy: 'auto' | 'pinned') => {
        if (!activeConversation) return
        await patchConversation(activeConversation.id, { modelStrategy })
    }, [activeConversation, patchConversation])

    const sendPrompt = useCallback(async (contextMessages: AIConversationMessage[] = activeConversation?.messages || []) => {
        const prompt = composer.trim()
        if (!prompt || !activeConversation) return
        if (sendingRef.current) return
        if (activeConversation.messages.at(-1)?.pending) {
            setStatusNotice('Wait for the current response to finish before sending another prompt.')
            return
        }
        const socket = socketRef.current
        const resolvedModel = resolveModelName(activeConversation, clients)
        if (!socket || socket.readyState !== WebSocket.OPEN || !resolvedModel) {
            if (pendingConversationDraft?.id !== activeConversation.id) {
                setConversations((prev) => prev.map((conversation) => conversation.id === activeConversation.id
                    ? appendError(conversation, 'No live model client is connected.')
                    : conversation))
            }
            setStatusNotice('No live model client is connected. Your draft is still here.')
            return
        }
        sendingRef.current = true
        try {
            const isDraft = pendingConversationDraft?.id === activeConversation.id
            let conversation = activeConversation
            if (isDraft) {
                try {
                    conversation = await promotePendingDraft(activeConversation, prompt.slice(0, 72), resolvedModel)
                } catch (error) {
                    setStatusNotice(error instanceof Error ? error.message : 'Couldn’t start a chat. Your draft is still here; try sending again.')
                    return
                }
            }
            const userMessage: AIConversationMessage = {
                id: crypto.randomUUID(),
                role: 'user',
                content: prompt,
                createdAt: new Date().toISOString(),
                modelName: resolvedModel,
            }
            const assistantMessage: AIConversationMessage = {
                id: `${conversation.id}-assistant-${Date.now()}`,
                role: 'assistant',
                content: '',
                pending: true,
                createdAt: new Date().toISOString(),
                modelName: resolvedModel,
            }
            const workspaceContext = await buildWorkspaceContext(
                conversation, importedRepos, shareContents, shareTrees, shareFileContents
            )
            const currentPage = typeof window === 'undefined' ? null : {
                hostname: window.location.hostname,
                url: `${window.location.origin}${window.location.pathname}`,
            }
            const messages = [
                { role: 'system' as const, content: buildSystemPrompt({ conversation, workspaceContext, currentPage }) },
                ...(isDraft ? conversation.messages : contextMessages)
                    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'tool')
                    .filter((message) => !(message.role === 'assistant' && ['queued', 'running'].includes(String(message.metadata?.promptPortalStatus))))
                    .map((message) => ({
                        role: message.role === 'tool' ? 'assistant' as const : message.role,
                        content: message.content,
                    })),
                { role: 'user' as const, content: prompt },
            ]
            const optimisticUpdatedAt = new Date().toISOString()
            const optimisticTitle = conversation.messages.length ? conversation.title : prompt.slice(0, 72)
            const optimisticConversation: AIConversation = {
                ...conversation,
                activeModel: resolvedModel,
                title: optimisticTitle,
                updatedAt: optimisticUpdatedAt,
                messages: [...conversation.messages, userMessage, assistantMessage],
            }
            try {
                socket.send(JSON.stringify({
                    type: 'prompt_request',
                    conversationId: conversation.id,
                    clientName: resolvedModel,
                    messages,
                    maxTokens: 1024,
                    temperature: 0.35,
                }))
            } catch {
                setStatusNotice('Couldn’t send your message. Your draft is still here; try again.')
                return
            }
            const nextConversations = conversationsRef.current.some((item) => item.id === conversation.id)
                ? conversationsRef.current.map((item) => item.id === conversation.id ? optimisticConversation : item)
                : [optimisticConversation, ...conversationsRef.current]
            conversationsRef.current = nextConversations
            updateConversationState(conversationsRef, setConversations, () => nextConversations)
            setComposer('')
            if (isDraft) setPendingConversationDraft(null)
            void Promise.all([
                patchConversation(conversation.id, { activeModel: resolvedModel, title: optimisticTitle }),
                persistMessage(conversation.id, userMessage),
                persistMessage(conversation.id, assistantMessage),
            ]).catch(() => {
                setStatusNotice('Chat history is syncing slowly. The live response was still sent to the model.')
            })
        } finally {
            sendingRef.current = false
        }
    }, [activeConversation, composer, clients, importedRepos, patchConversation, persistMessage,
        setComposer, setConversations, setStatusNotice, shareContents, shareFileContents, shareTrees,
        socketRef, conversationsRef, pendingConversationDraft, promotePendingDraft, setPendingConversationDraft])

    return { setPreferredModel, setModelStrategy, sendPrompt }
}
