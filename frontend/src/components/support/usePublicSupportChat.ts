import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSupportLive from './useSupportLive'
import useSupportUnread from './useSupportUnread'
import { supportFetch } from '@/utils/support/api'
import { createPublicSupportChatActions } from './publicSupportChatActions'
import type { PublicSupportChatOptions, PublicSupportConversation, PublicSupportMessage, PublicSupportSubmission, PublicSupportTicket } from './publicSupportChatTypes'

const emptyTickets: PublicSupportTicket[] = []
const empty: PublicSupportConversation = { channel: 'ai', status: 'open', pending: false, messages: [] }

export function usePublicSupportChat({ active = true, onUnreadChange, onResolvedChange, initialConversation, initialSelectedId = '' }: PublicSupportChatOptions) {
    const [selectedId, setSelectedId] = useState(initialConversation?.id || initialSelectedId)
    const selection = useRef(initialConversation?.id || initialSelectedId)
    const restoredSelection = useRef(false)
    const realtime = useRef(false)
    const drafts = useRef<Record<string, string>>({})
    const [conversation, setConversation] = useState<PublicSupportConversation>(initialConversation || empty)
    const [viewingClosedChat, setViewingClosedChat] = useState(false)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(!initialConversation)
    const [pendingMessages, setPendingMessages] = useState<Record<string, PublicSupportSubmission>>({})
    const [transfers, setTransfers] = useState<Record<string, boolean>>({})
    const sending = Boolean(pendingMessages[selectedId])
    const transferring = Boolean(transfers[selectedId])
    const [error, setError] = useState('')
    const [refreshError, setRefreshError] = useState('')
    const [closing, setClosing] = useState(false)
    const [retry, setRetry] = useState<PublicSupportSubmission | null>(null)
    const log = useRef<HTMLDivElement>(null)
    const closedLog = useRef<HTMLDivElement>(null)
    const mounted = useRef(true)
    const serverConversation = useRef(Boolean(initialConversation))
    const revision = useRef(0)
    const inFlight = useRef(new Map<string, string>())
    const failures = useRef<Record<string, { message: string; submission: PublicSupportSubmission }>>({})

    const refresh = useCallback(async () => {
        const version = ++revision.current
        const url = `/support/chat${selection.current ? `?conversationId=${encodeURIComponent(selection.current)}` : ''}`
        const response = await supportFetch(url)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'We could not load your conversation.')
        if (mounted.current && version === revision.current) {
            realtime.current = Array.isArray(payload.tickets)
            if (!realtime.current) {
                selection.current = ''
                setSelectedId('')
            }
            if (restoredSelection.current) {
                restoredSelection.current = false
                if (!payload.id && selection.current) {
                    selection.current = crypto.randomUUID()
                    setSelectedId(selection.current)
                }
            }
            migrateReadMarker(payload)
            setConversation(payload)
            onResolvedChange?.(payload.status === 'closed' && !viewingClosedChat)
            setRefreshError('')
            setLoading(false)
            if (payload.status !== 'closed' && viewingClosedChat) setViewingClosedChat(false)
            if (!selection.current && payload.id) {
                selection.current = payload.id
                setSelectedId(payload.id)
            }
        }
        return realtime.current && Array.isArray(payload.tickets)
            && payload.tickets.some((ticket: PublicSupportTicket) => ticket.status === 'open')
    }, [onResolvedChange, viewingClosedChat])

    useEffect(() => {
        mounted.current = true
        if (!serverConversation.current) {
            try {
                selection.current = localStorage.getItem('hanasand-support-selected') || ''
                restoredSelection.current = Boolean(selection.current)
                setSelectedId(selection.current)
            } catch { /* Use the newest conversation. */ }
        }
        return () => { mounted.current = false }
    }, [])
    useEffect(() => {
        if (selectedId) try { localStorage.setItem('hanasand-support-selected', selectedId) } catch { /* Selection remains available in this tab. */ }
    }, [selectedId])

    const connection = useSupportLive(async () => {
        try {
            return await refresh()
        } catch (cause) {
            if (mounted.current) {
                setRefreshError(cause instanceof Error ? cause.message : 'Reconnecting…')
                setLoading(false)
            }
        }
    }, true, active)
    const legacy = !Array.isArray(conversation.tickets)
    const tickets = useMemo(() => conversation.tickets || (conversation.messages.length ? [{
        id: 'legacy', subject: 'Support',
        reply_count: conversation.messages.filter(message => ['assistant', 'support'].includes(message.sender_kind)).length,
    }] : emptyTickets), [conversation])
    const unread = useSupportUnread(tickets, legacy ? 'legacy' : selectedId, active, 'visitor')
    useEffect(() => {
        onUnreadChange?.(Object.values(unread).reduce((sum, count) => sum + count, 0))
    }, [unread, onUnreadChange])

    async function selectChat(id: string) {
        drafts.current[selection.current] = input
        selection.current = id
        setSelectedId(id)
        try { localStorage.setItem('hanasand-support-selected', id) } catch { /* Selection remains available in this tab. */ }
        revision.current += 1
        setInput(drafts.current[id] || '')
        setError(failures.current[id]?.message || '')
        setRetry(failures.current[id]?.submission || null)
        setConversation(current => ({ ...empty, id, tickets: current.tickets }))
        setLoading(true)
        try { await refresh() } catch { setRefreshError('Could not load this chat. Reconnecting…') } finally { setLoading(false) }
    }

    useEffect(() => {
        if (!active) return
        const currentLog = viewingClosedChat ? closedLog.current : log.current
        if (currentLog) currentLog.scrollTop = currentLog.scrollHeight
    }, [active, conversation.messages.length, sending, viewingClosedChat])

    const actions = createPublicSupportChatActions({
        conversation, selectedId, setSelectedId, input, setInput, retry, setRetry, setError, closing, setClosing,
        setConversation, setViewingClosedChat, onResolvedChange, legacy, selection, drafts, mounted, revision,
        inFlight, failures, setTransfers, setPendingMessages, selectChat, refresh,
    })

    const visibleMessages = optimisticMessages(conversation.messages, pendingMessages[selectedId])
    const human = conversation.channel === 'human'
    const agentName = conversation.agent_name || conversation.messages.filter(message => message.sender_kind === 'support').at(-1)?.sender_name
    const busy = sending || conversation.pending
    const lastMessage = conversation.messages.at(-1)
    const unanswered: PublicSupportSubmission | null = !human && !busy && lastMessage?.sender_kind === 'user' && lastMessage.request_id
        ? { requestId: lastMessage.request_id, message: lastMessage.body } : null
    const retryable: PublicSupportSubmission | null = retry || unanswered

    return {
        selectedId, conversation, viewingClosedChat, setViewingClosedChat, input, setInput, loading,
        sending, transferring, closing, error, refreshError, connection, human, agentName, busy,
        retryable, visibleMessages, log, closedLog, legacy, ...actions,
    }
}

function migrateReadMarker(payload: PublicSupportConversation) {
    try {
        const key = 'hanasand-support-read:visitor'
        const read = JSON.parse(localStorage.getItem(key) || '{}')
        const readId = payload.id || 'legacy'
        if (read[readId] === undefined) {
            const replies = payload.messages.filter(message => ['assistant', 'support'].includes(message.sender_kind))
            const index = replies.findIndex(message => message.id === localStorage.getItem('hanasand-support-last-read'))
            if (index >= 0) {
                read[readId] = index + 1
                localStorage.setItem(key, JSON.stringify(read))
            }
        }
    } catch { /* Read markers are optional when browser storage is unavailable. */ }
}

function optimisticMessages(messages: PublicSupportMessage[], outgoing: PublicSupportSubmission | undefined) {
    if (!outgoing || messages.some(message => message.request_id === outgoing.requestId)) return messages
    return [...messages, {
        id: outgoing.requestId, body: outgoing.message, sender_kind: 'user' as const, sender_name: 'You',
    }]
}
