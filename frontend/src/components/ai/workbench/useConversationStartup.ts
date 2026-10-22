import { useCallback, useEffect, useRef } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import { createConversation, toConversationPayload } from './conversationModel'
import { promoteDraftOnce, readPendingConversationDraft, reusePendingConversationDraft } from './conversationDraftStorage'
import type { WorkbenchState } from './useWorkbenchState'
import { buildRecoveryNotice } from './recoveryNotice'
export { buildRecoveryNotice } from './recoveryNotice'

export function useConversationStartup(state: WorkbenchState) {
    const {
        conversations, isAuthenticated, initialConversationId, initialRuntimeState,
        initialWorkspaceUnavailable = false,
        conversationsRef, createNewConversationRef, bootstrappedRef, setConversations,
        setActiveConversationId, activeConversationId, setStatusNotice, setResumeNotice,
        pendingConversationDraftRef, setPendingConversationDraft, setConversationDraftRestored,
    } = state
    const promotionsRef = useRef(new Map<string, Promise<AIConversation>>())

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations, conversationsRef])

    useEffect(() => {
        if (typeof window === 'undefined') {
            setConversationDraftRestored(true)
            return
        }
        const storedDraft = readPendingConversationDraft()
        const existingDraftConversation = storedDraft
            ? conversationsRef.current.find((conversation) => conversation.id === storedDraft.conversation.id)
            : null
        if (existingDraftConversation) {
            setPendingConversationDraft(null)
        } else {
            setPendingConversationDraft(storedDraft?.conversation || null)
        }

        let savedConversationId: string | null = null
        try { savedConversationId = window.localStorage.getItem('hanasand.ai.activeConversationId') } catch { /* Storage may be disabled. */ }
        const runtimeConversationId = initialRuntimeState?.activeConversationId || null
        const candidateId = initialConversationId || pendingConversationDraftRef.current?.id || savedConversationId || runtimeConversationId
        const exists = (id: string | null) => Boolean(id && (
            conversationsRef.current.some((conversation) => conversation.id === id)
            || pendingConversationDraftRef.current?.id === id
        ))
        const nextConversationId = exists(candidateId)
            ? candidateId
            : conversationsRef.current.find((conversation) => !conversation.archivedAt)?.id
                || conversationsRef.current[0]?.id
                || pendingConversationDraftRef.current?.id
                || null
        if (nextConversationId) setActiveConversationId(nextConversationId)

        if (initialConversationId || !nextConversationId || pendingConversationDraftRef.current?.id === nextConversationId) {
            setConversationDraftRestored(true)
            return
        }
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
        setConversationDraftRestored(true)
    }, [conversationsRef, initialConversationId, initialRuntimeState, pendingConversationDraftRef, setActiveConversationId, setConversationDraftRestored, setPendingConversationDraft, setResumeNotice])

    useEffect(() => {
        if (typeof window === 'undefined' || !activeConversationId) return
        try { window.localStorage.setItem('hanasand.ai.activeConversationId', activeConversationId) } catch { /* Storage may be disabled. */ }
    }, [activeConversationId])

    const createNewConversation = useCallback(async () => {
        const storedDraft = readPendingConversationDraft()
        const conversation = reusePendingConversationDraft(pendingConversationDraftRef.current, storedDraft, createConversation)
        if (pendingConversationDraftRef.current?.id !== conversation.id) {
            setPendingConversationDraft(conversation)
        }
        setActiveConversationId(conversation.id)
        setStatusNotice(null)
    }, [pendingConversationDraftRef, setActiveConversationId, setPendingConversationDraft, setStatusNotice])

    useEffect(() => {
        createNewConversationRef.current = createNewConversation
    }, [createNewConversation, createNewConversationRef])

    const promotePendingDraft = useCallback(async (draft: AIConversation, title: string, modelName: string) => {
        const existing = conversationsRef.current.find((conversation) => conversation.id === draft.id)
        if (existing) return existing
        if (pendingConversationDraftRef.current?.id !== draft.id) return draft
        return promoteDraftOnce(draft.id, promotionsRef.current, async () => {
            if (!isAuthenticated) throw new Error('Sign in to start a chat.')
            const promotedConversation: AIConversation = {
                ...draft,
                title,
                activeModel: modelName,
                updatedAt: new Date().toISOString(),
            }
            const response = await aiClientRequest('/ai/conversations', {
                method: 'POST',
                body: JSON.stringify(toConversationPayload(promotedConversation)),
            })
            if (!response.ok) throw new Error('Couldn’t start a chat. Your draft is still here; try sending again.')
            const nextConversations = [
                promotedConversation,
                ...conversationsRef.current.filter((conversation) => conversation.id !== draft.id),
            ]
            conversationsRef.current = nextConversations
            setConversations(nextConversations)
            return promotedConversation
        })
    }, [conversationsRef, isAuthenticated, pendingConversationDraftRef, setConversations])

    useEffect(() => {
        if (!state.conversationDraftRestored || bootstrappedRef.current || initialWorkspaceUnavailable || conversationsRef.current.some((conversation) => !conversation.archivedAt)) return
        bootstrappedRef.current = true
        if (pendingConversationDraftRef.current) {
            setActiveConversationId(pendingConversationDraftRef.current.id)
            return
        }
        const timer = setTimeout(() => void createNewConversationRef.current(), 0)
        return () => clearTimeout(timer)
    }, [bootstrappedRef, conversationsRef, createNewConversationRef, initialWorkspaceUnavailable, pendingConversationDraftRef, setActiveConversationId, state.conversationDraftRestored])

    return { createNewConversation, promotePendingDraft }
}
