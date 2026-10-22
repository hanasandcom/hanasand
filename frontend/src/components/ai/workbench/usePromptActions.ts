import { useCallback } from 'react'
import { useRef } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import { appendError, buildSystemPrompt, buildWorkspaceContext, resolveModelName } from './helpers'
import { promoteDraftOnce } from './conversationDraftStorage'
import { toConversationPayload, updateConversationState } from './conversationModel'
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
        pendingConversationDraft, setPendingConversationDraft,
    } = state
    const sendingRef = useRef(false)
    const draftPromotionsRef = useRef(new Map<string, Promise<void>>())

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
            if (isDraft && !state.isAuthenticated) {
                setStatusNotice('Sign in to start a chat.')
                return
            }
            const conversation = activeConversation
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
            const publishPrompt = () => {
                socket.send(JSON.stringify({
                    type: 'prompt_request',
                    conversationId: conversation.id,
                    clientName: resolvedModel,
                    messages,
                    maxTokens: 1024,
                    temperature: 0.35,
                }))
            }
            const nextConversations = conversationsRef.current.some((item) => item.id === conversation.id)
                ? conversationsRef.current.map((item) => item.id === conversation.id ? optimisticConversation : item)
                : [optimisticConversation, ...conversationsRef.current]
            const publishOptimisticConversation = () => {
                conversationsRef.current = nextConversations
                updateConversationState(conversationsRef, setConversations, () => nextConversations)
                setComposer('')
                if (isDraft) setPendingConversationDraft(optimisticConversation)
            }
            let promotion: Promise<void> | null = null
            try {
                if (isDraft) {
                    promotion = handoffDraftPrompt(publishPrompt, publishOptimisticConversation, () => (
                        promoteDraftOnce(conversation.id, draftPromotionsRef.current, async () => {
                            const response = await aiClientRequest('/ai/conversations', {
                                method: 'POST',
                                body: JSON.stringify(toConversationPayload({
                                    ...optimisticConversation,
                                    title: optimisticTitle,
                                    activeModel: resolvedModel,
                                })),
                            })
                            if (!response.ok) throw new Error('Couldn’t save the new chat.')

                            // The model can answer before the conversation POST completes. Read the
                            // current ref after creation so that response events are included here.
                            const latestConversation = conversationsRef.current.find((item) => item.id === conversation.id)
                            for (const message of latestConversation?.messages || optimisticConversation.messages) {
                                const messageResponse = await aiClientRequest(`/ai/conversations/${conversation.id}/messages`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                        id: message.id,
                                        role: message.role,
                                        content: message.content,
                                        pending: Boolean(message.pending),
                                        error: Boolean(message.error),
                                        modelName: message.modelName || null,
                                        metadata: message.metadata || {},
                                        createdAt: message.createdAt,
                                    }),
                                })
                                if (!messageResponse.ok) throw new Error('Chat history is still syncing.')
                            }
                        })
                    ))
                } else {
                    publishPrompt()
                    publishOptimisticConversation()
                }
            } catch {
                setStatusNotice('Couldn’t send your message. Your draft is still here; try again.')
                return
            }
            if (isDraft) {
                void promotion?.then(() => {
                    setPendingConversationDraft(null)
                }).catch((error) => {
                    const latestConversation = conversationsRef.current.find((item) => item.id === conversation.id)
                    if (latestConversation) setPendingConversationDraft(latestConversation)
                    setStatusNotice(error instanceof Error && error.message === 'Chat history is still syncing.'
                        ? 'Your message was sent, but chat history is still syncing. The draft is still here.'
                        : 'Your message was sent, but the chat could not be saved. The draft is still here.')
                })
            } else {
                void Promise.all([
                    patchConversation(conversation.id, { activeModel: resolvedModel, title: optimisticTitle }),
                    persistMessage(conversation.id, userMessage),
                    persistMessage(conversation.id, assistantMessage),
                ]).catch(() => {
                    setStatusNotice('Chat history is syncing slowly. The live response was still sent to the model.')
                })
            }
        } finally {
            sendingRef.current = false
        }
    }, [activeConversation, composer, clients, importedRepos, patchConversation, persistMessage,
        setComposer, setConversations, setStatusNotice, shareContents, shareFileContents, shareTrees,
        socketRef, conversationsRef, pendingConversationDraft, setPendingConversationDraft, state.isAuthenticated])

    return { setPreferredModel, setModelStrategy, sendPrompt }
}

export function handoffDraftPrompt<T>(send: () => void, publish: () => void, persist: () => Promise<T>) {
    send()
    publish()
    return persist()
}
