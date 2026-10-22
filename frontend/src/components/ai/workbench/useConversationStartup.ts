import { useEffect } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import { createConversation, toConversationPayload } from './conversationModel'
import type { WorkbenchState } from './useWorkbenchState'

export function buildRecoveryNotice(savedConversationId: string | null, nextConversationId: string, conversation: AIConversation | null, runtimeState: AIRuntimeState | null | undefined, lastShownKey: string | null = null) {
    const failure = runtimeState?.lastFailure
    const toolRun = runtimeState?.lastToolRun
    const detail = failure?.message || toolRun?.detail || null
    if (!detail) return null
    const recoveryKey = `${nextConversationId}:${failure?.updatedAt || toolRun?.updatedAt || ''}:${detail}`
    if (lastShownKey === recoveryKey) return null
    const source = savedConversationId === nextConversationId ? 'your last repository selection' : 'the most recent runtime activity'
    return {
        message: `Recovered ${source}: ${detail}`,
        conversationId: nextConversationId,
        workspaceId: conversation?.workspaceId || null,
        recoveryKey,
    }
}

export function useConversationStartup(state: WorkbenchState) {
    const {
        conversations, isAuthenticated, initialConversationId, initialRuntimeState,
        initialWorkspaceUnavailable = false,
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
        let lastShownKey: string | null = null
        try {
            lastShownKey = window.localStorage.getItem('hanasand.ai.lastRecoveryNotice')
        } catch { /* Continue without persisting notice history when storage is unavailable. */ }
        const notice = buildRecoveryNotice(savedConversationId, nextConversationId, resumedConversation, initialRuntimeState, lastShownKey)
        if (notice) {
            try { window.localStorage.setItem('hanasand.ai.lastRecoveryNotice', notice.recoveryKey) } catch { /* The current notice remains useful without persistent storage. */ }
            setResumeNotice({ message: notice.message, conversationId: notice.conversationId, workspaceId: notice.workspaceId })
        }
    }, [conversationsRef, initialConversationId, initialRuntimeState, setActiveConversationId, setResumeNotice])
    useEffect(() => {
        if (typeof window === 'undefined' || !activeConversationId) return
        window.localStorage.setItem('hanasand.ai.activeConversationId', activeConversationId)
    }, [activeConversationId])
    useEffect(() => {
        createNewConversationRef.current = async () => {
            const conversation = createConversation()
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
    }, [createNewConversationRef, isAuthenticated, setActiveConversationId, setConversations, setStatusNotice])
    useEffect(() => {
        if (bootstrappedRef.current || initialWorkspaceUnavailable || conversations.some((conversation) => !conversation.archivedAt)) return
        bootstrappedRef.current = true
        const timer = setTimeout(() => void createNewConversationRef.current(), 0)
        return () => clearTimeout(timer)
    }, [bootstrappedRef, conversations, createNewConversationRef, initialWorkspaceUnavailable])

    return () => createNewConversationRef.current()
}
