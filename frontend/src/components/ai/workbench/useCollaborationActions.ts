import { useCallback } from 'react'
import { aiClientRequest } from '@/utils/ai/client'
import type { WorkbenchState } from './useWorkbenchState'

export function useCollaborationActions(
    state: WorkbenchState,
    activeConversation: AIConversation | null,
    resolvedActiveConversationId: string | null,
    replaceConversation: (conversation: AIConversation) => void,
    updateLocalConversation: (id: string, patch: Partial<AIConversation>) => void
) {
    const {
        isAuthenticated, currentUserId, setCollaborationError, setCollaboratorPending,
        setStatusNotice, setConversations, conversationsRef, setActiveConversationId,
    } = state
    const inviteCollaborator = useCallback(async (userId: string, role: 'reviewer' | 'editor') => {
        if (!activeConversation) {
            setCollaborationError('Open a conversation before inviting collaborators.')
            return
        }
        if (!isAuthenticated) {
            setCollaborationError('Sign in to invite collaborators.')
            return
        }
        const trimmedUserId = userId.trim()
        if (!trimmedUserId) {
            setCollaborationError('Enter a user id before inviting a collaborator.')
            return
        }
        if (!activeConversation.collaboration?.canInvite) {
            setCollaborationError('Only the conversation owner can invite collaborators.')
            return
        }
        setCollaboratorPending(true)
        setCollaborationError(null)
        try {
            const response = await aiClientRequest(`/ai/conversations/${activeConversation.id}/collaborators`, {
                method: 'POST',
                body: JSON.stringify({ userId: trimmedUserId, role }),
            })
            const payload = await response.json().catch(() => null) as { conversation?: AIConversation, error?: string } | null
            if (!response.ok || !payload?.conversation) throw new Error(payload?.error || 'Unable to invite collaborator.')
            replaceConversation(payload.conversation)
            setStatusNotice(`Shared this review session with ${trimmedUserId} as ${role}.`)
        } catch (error) {
            setCollaborationError(error instanceof Error ? error.message : 'Unable to invite collaborator.')
        } finally {
            setCollaboratorPending(false)
        }
    }, [activeConversation, isAuthenticated, replaceConversation, setCollaborationError, setCollaboratorPending, setStatusNotice])

    const removeCollaborator = useCallback(async (targetUserId: string) => {
        if (!activeConversation) {
            setCollaborationError('Open a conversation before updating collaborators.')
            return
        }
        if (!isAuthenticated) {
            setCollaborationError('Sign in to update collaborators.')
            return
        }
        const trimmedUserId = targetUserId.trim()
        if (!trimmedUserId) {
            setCollaborationError('Missing collaborator id.')
            return
        }
        setCollaboratorPending(true)
        setCollaborationError(null)
        try {
            const response = await aiClientRequest(`/ai/conversations/${activeConversation.id}/collaborators/${encodeURIComponent(trimmedUserId)}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null) as {
                ok?: boolean
                conversation?: AIConversation | null
                error?: string
            } | null
            if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to remove collaborator.')
            if (payload.conversation) {
                replaceConversation(payload.conversation)
            } else if (trimmedUserId === currentUserId && activeConversation.collaboration.role !== 'owner') {
                setConversations((prev) => prev.filter((conversation) => conversation.id !== activeConversation.id))
                if (resolvedActiveConversationId === activeConversation.id) {
                    const nextConversation = conversationsRef.current.find((conversation) => conversation.id !== activeConversation.id && !conversation.archivedAt)
                        || conversationsRef.current.find((conversation) => conversation.id !== activeConversation.id)
                        || null
                    setActiveConversationId(nextConversation?.id || null)
                }
            } else {
                updateLocalConversation(activeConversation.id, {
                    collaboration: {
                        ...activeConversation.collaboration,
                        collaborators: activeConversation.collaboration.collaborators.filter((collaborator) => collaborator.userId !== trimmedUserId),
                        seatCount: Math.max(activeConversation.collaboration.seatCount - 1, 0),
                        remainingSeats: Math.min(activeConversation.collaboration.remainingSeats + 1, activeConversation.collaboration.seatLimit),
                    },
                })
            }
            setStatusNotice(trimmedUserId === currentUserId && activeConversation.collaboration.role !== 'owner'
                ? 'You left the shared review session.'
                : `Removed ${trimmedUserId} from this review session.`)
        } catch (error) {
            setCollaborationError(error instanceof Error ? error.message : 'Unable to remove collaborator.')
        } finally {
            setCollaboratorPending(false)
        }
    }, [activeConversation, currentUserId, isAuthenticated, resolvedActiveConversationId, replaceConversation,
        updateLocalConversation, setActiveConversationId, setCollaborationError, setCollaboratorPending,
        setConversations, setStatusNotice, conversationsRef])

    return { inviteCollaborator, removeCollaborator }
}
