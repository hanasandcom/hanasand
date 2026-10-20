import { useEffect } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import { createConversation, toConversationPayload } from './conversationModel'
import type { WorkbenchState } from './useWorkbenchState'

export function useConversationStartup(state: WorkbenchState) {
    const {
        conversations, clients, isAuthenticated, initialConversationId, initialRuntimeState,
        conversationsRef, createNewConversationRef, bootstrappedRef, setConversations,
        setActiveConversationId, activeConversationId, setStatusNotice, setResumeNotice,
    } = state
    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations, conversationsRef])
    useEffect(() => {
        if (typeof window === 'undefined') return
        const savedConversationId = window.localStorage.getItem('hanasand.ai.activeConversationId')
        const runtimeConversationId = initialRuntimeState?.activeConversationId || null
        const nextConversationId = initialConversationId || savedConversationId || runtimeConversationId
        if (!nextConversationId || !conversationsRef.current.some((conversation) => conversation.id === nextConversationId)) return
        setActiveConversationId(nextConversationId)
        if (initialConversationId) return
        const resumedConversation = conversationsRef.current.find((conversation) => conversation.id === nextConversationId) || null
        const source = savedConversationId === nextConversationId ? 'your last build workspace selection' : 'the most recent runtime activity'
        const detail = initialRuntimeState?.lastFailure?.message || initialRuntimeState?.lastToolRun?.detail || null
        setResumeNotice({
            message: detail ? `Recovered ${source}: ${detail}` : `Recovered ${source}.`,
            conversationId: nextConversationId,
            workspaceId: resumedConversation?.workspaceId || null,
        })
    }, [conversationsRef, initialConversationId, initialRuntimeState, setActiveConversationId, setResumeNotice])
    useEffect(() => {
        if (typeof window === 'undefined' || !activeConversationId) return
        window.localStorage.setItem('hanasand.ai.activeConversationId', activeConversationId)
    }, [activeConversationId])
    useEffect(() => {
        createNewConversationRef.current = async () => {
            const conversation = createConversation(clients[0]?.name || null)
            setConversations((prev) => [conversation, ...prev])
            setActiveConversationId(conversation.id)
            setStatusNotice(null)
            if (!isAuthenticated) return
            try {
                const response = await aiClientRequest('/ai/conversations', {
                    method: 'POST',
                    body: JSON.stringify(toConversationPayload(conversation)),
                })
                if (!response.ok) throw new Error('Couldn’t start a chat.')
            } catch (error) {
                setStatusNotice(error instanceof Error ? error.message : 'Couldn’t start a chat.')
            }
        }
    }, [clients, createNewConversationRef, isAuthenticated, setActiveConversationId, setConversations, setStatusNotice])
    useEffect(() => {
        if (bootstrappedRef.current || conversations.some((conversation) => !conversation.archivedAt)) return
        bootstrappedRef.current = true
        const timer = setTimeout(() => void createNewConversationRef.current(), 0)
        return () => clearTimeout(timer)
    }, [bootstrappedRef, conversations, createNewConversationRef])

    return () => createNewConversationRef.current()
}
