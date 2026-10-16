import type { Dispatch, MutableRefObject, SetStateAction, FormEvent } from 'react'
import { supportFetch } from '@/utils/support/api'
import { SUPPORT_CHAT_OPENED_EVENT } from './useSupportLive'
import type { PublicSupportConversation, PublicSupportSubmission } from './publicSupportChatTypes'

type ActionContext = {
    conversation: PublicSupportConversation
    selectedId: string
    setSelectedId: Dispatch<SetStateAction<string>>
    input: string
    setInput: Dispatch<SetStateAction<string>>
    retry: PublicSupportSubmission | null
    setRetry: Dispatch<SetStateAction<PublicSupportSubmission | null>>
    setError: Dispatch<SetStateAction<string>>
    closing: boolean
    setClosing: Dispatch<SetStateAction<boolean>>
    setConversation: Dispatch<SetStateAction<PublicSupportConversation>>
    setViewingClosedChat: Dispatch<SetStateAction<boolean>>
    onResolvedChange?: (resolved: boolean) => void
    legacy: boolean
    selection: MutableRefObject<string>
    drafts: MutableRefObject<Record<string, string>>
    mounted: MutableRefObject<boolean>
    revision: MutableRefObject<number>
    inFlight: MutableRefObject<Map<string, string>>
    failures: MutableRefObject<Record<string, { message: string; submission: PublicSupportSubmission }>>
    setTransfers: Dispatch<SetStateAction<Record<string, boolean>>>
    setPendingMessages: Dispatch<SetStateAction<Record<string, PublicSupportSubmission>>>
    selectChat: (id: string) => Promise<void>
    refresh: () => Promise<boolean>
}

export function createPublicSupportChatActions(context: ActionContext) {
    const {
        conversation, selectedId, setSelectedId, input, setInput, retry, setRetry, setError, closing, setClosing,
        setConversation, setViewingClosedChat, onResolvedChange, legacy, selection, drafts,
        mounted, revision, inFlight, failures, setTransfers, setPendingMessages, selectChat, refresh,
    } = context

    async function submit(submission: PublicSupportSubmission) {
        const id = submission.conversationId || selection.current || (legacy ? '' : crypto.randomUUID())
        submission = { ...submission, conversationId: id || undefined }
        if (!selection.current && id) {
            selection.current = id
            setSelectedId(id)
        }
        const handoff = submission.handoff === true
        const key = `${id}:${handoff ? 'handoff' : 'message'}`
        if (inFlight.current.has(key)) return
        inFlight.current.set(key, submission.requestId)
        if (handoff) setTransfers(current => ({ ...current, [id]: true }))
        else setPendingMessages(current => ({ ...current, [id]: submission }))
        revision.current += 1
        setError('')
        try {
            const response = await supportFetch('/support/chat', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(submission),
            })
            const payload = await response.json() as PublicSupportConversation
            if (!response.ok) throw new Error(payload.error || 'We could not send your message. Please try again.')
            if (!mounted.current) return
            revision.current += 1
            const shouldConnect = await refresh()
            if (shouldConnect) window.dispatchEvent(new Event(SUPPORT_CHAT_OPENED_EVENT))
            if (payload.accepted !== false && !handoff && (!submission.conversationId || selection.current === submission.conversationId)) {
                setInput(current => current.trim() === submission.message ? '' : current)
            }
            if (payload.accepted !== false && drafts.current[id]?.trim() === submission.message) delete drafts.current[id]
            if (payload.error && !handoff) failures.current[id] = { message: payload.error, submission }
            else delete failures.current[id]
            if (selection.current === id) {
                setRetry(payload.error && !handoff ? submission : null)
                setError(payload.error || '')
            }
            if (handoff) {
                inFlight.current.delete(`${id}:message`)
                setPendingMessages(current => { const next = { ...current }; delete next[id]; return next })
            }
        } catch (cause) {
            if (mounted.current) {
                const message = cause instanceof Error ? cause.message : 'We could not send your message. Please try again.'
                failures.current[id] = { message, submission }
                if (selection.current === id) {
                    setError(message)
                    setRetry(submission)
                }
            }
        } finally {
            if (inFlight.current.get(key) === submission.requestId) inFlight.current.delete(key)
            if (handoff) setTransfers(current => { const next = { ...current }; delete next[id]; return next })
            else setPendingMessages(current => {
                if (current[id]?.requestId !== submission.requestId) return current
                const next = { ...current }
                delete next[id]
                return next
            })
        }
    }

    function send(event: FormEvent) {
        event.preventDefault()
        const message = input.trim()
        if (!message || conversation.status === 'closed') return
        void submit(retry?.message === message ? retry : { requestId: crypto.randomUUID(), message })
    }

    function startNewChat() {
        setViewingClosedChat(false)
        onResolvedChange?.(false)
        void selectChat(crypto.randomUUID())
    }

    async function endConversation() {
        if (!conversation.id || closing) return
        setClosing(true)
        setError('')
        try {
            const response = await supportFetch('/support/chat', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'resolve', conversationId: conversation.id }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'Could not close this conversation.')
            revision.current += 1
            await refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not close this conversation.')
        } finally { setClosing(false) }
    }

    async function sendFeedback(rating: number, comment: string) {
        const id = selectedId, version = conversation.resolution_version
        revision.current += 1
        const response = await supportFetch('/support/chat', {
            method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'feedback', conversationId: id, resolutionVersion: version, rating, comment }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not save feedback.')
        if (mounted.current && selection.current === id) {
            revision.current += 1
            setConversation(current => current.id === id && current.resolution_version === version && current.status === 'closed'
                ? { ...current, feedback_rating: rating, feedback_comment: comment } : current)
        }
    }

    async function sendCloseFeedback(foundWhatLookingFor: boolean, reason?: string) {
        const id = selectedId, version = conversation.resolution_version
        const response = await supportFetch('/support/chat', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'close-feedback', conversationId: id, resolutionVersion: version, foundWhatLookingFor, reason }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not save your answer.')
    }

    return { submit, send, startNewChat, endConversation, sendFeedback, sendCloseFeedback }
}
