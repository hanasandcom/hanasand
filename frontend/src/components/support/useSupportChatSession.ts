import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { getCookie } from 'hanasand/cookies'
import { supportFetch } from '@/utils/support/api'
import { SUPPORT_TICKETS_UPDATED_EVENT } from '@/utils/supportUnread'
import useSupportLive, { SUPPORT_CHAT_OPENED_EVENT } from './useSupportLive'
import useSupportUnread from './useSupportUnread'
import { matchesStatusFilter } from './supportTicketFilters'
import type { InitialChat, Message, Ticket, TicketFilters } from './supportChatTypes'

export function useSupportChatSession(initialChat: InitialChat | undefined, filters: MutableRefObject<TicketFilters>, startNewTicket = false, initialMessage = '') {
    const [tickets, setTickets] = useState<Ticket[]>(initialChat?.tickets || [])
    const initialSelectedId = startNewTicket ? '' : initialChat?.isSupport
        ? initialChat.tickets.find(ticket => ticket.id === initialChat.selectedId && ticket.status !== 'closed')?.id || initialChat.tickets.find(ticket => ticket.status !== 'closed')?.id || ''
        : initialChat?.selectedId || ''
    const [selectedId, setSelectedId] = useState(initialSelectedId)
    const selectedRef = useRef('')
    const messageRevision = useRef(0)
    const ticketRevision = useRef(0)
    const realtime = useRef(initialChat?.realtime || false)
    selectedRef.current = selectedId
    const creating = useRef(false)
    const drafts = useRef<Record<string, string>>({})
    const log = useRef<HTMLDivElement>(null)
    const initialMessagesLoaded = useRef(false)
    const [messages, setMessages] = useState<Message[]>(initialChat?.messages || [])
    const [readSelectedId, setReadSelectedId] = useState('')
    const [input, setInput] = useState(initialMessage)
    const [isSupport, setIsSupport] = useState(initialChat?.isSupport === true)
    const isSupportRef = useRef(initialChat?.isSupport === true)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(!initialChat)
    const [syncedId, setSyncedId] = useState('')
    const [signedOut, setSignedOut] = useState(false)
    const [userId, setUserId] = useState('')

    const loadTickets = useCallback(async () => {
        const version = ++ticketRevision.current
        const controls = filters.current
        const params = new URLSearchParams()
        const query = controls.search.trim()
        if (query) params.set('search', query)
        if (controls.from) params.set('from', controls.from)
        if (controls.to) params.set('to', controls.to)
        if (controls.stars !== 'all') params.set('stars', controls.stars)
        if (controls.feedback !== 'all') params.set('feedback', controls.feedback)
        const suffix = params.size ? `?${params.toString()}` : ''
        const response = await supportFetch(`/support/tickets${suffix}`)
        setSignedOut(response.status === 401)
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to chat with support.' : 'Support is temporarily unavailable.')
        const payload = await response.json() as { tickets?: Ticket[]; isSupport?: boolean; realtime?: boolean }
        if (version !== ticketRevision.current) return
        realtime.current = payload.realtime === true
        const updatedTickets = payload.tickets || []
        const supportQueue = payload.isSupport === true
        isSupportRef.current = supportQueue
        setTickets(updatedTickets)
        window.dispatchEvent(new CustomEvent(SUPPORT_TICKETS_UPDATED_EVENT, {
            detail: { scope: `user:${getCookie('impersonating_id') || getCookie('id') || ''}`, tickets: updatedTickets },
        }))
        if (!supportQueue && updatedTickets.some(ticket => ticket.status === 'open')) window.dispatchEvent(new Event(SUPPORT_CHAT_OPENED_EVENT))
        setIsSupport(supportQueue)
        setSelectedId(current => {
            if (creating.current) return current
            if (startNewTicket && !current) return ''
            const currentVisible = updatedTickets.some(ticket => ticket.id === current && matchesStatusFilter(ticket, controls.status))
            return currentVisible ? current : updatedTickets.find(ticket => matchesStatusFilter(ticket, controls.status))?.id || ''
        })
        return payload.tickets || []
    }, [filters, startNewTicket])

    const loadMessages = useCallback(async (id: string, signal?: AbortSignal) => {
        if (!id) return
        const version = ++messageRevision.current
        const response = await supportFetch(`/support/tickets/${encodeURIComponent(id)}/messages`, { signal })
        if (!response.ok) throw new Error('We could not load this conversation.')
        const payload = await response.json() as { messages?: Message[] }
        if (!signal?.aborted && selectedRef.current === id && version === messageRevision.current) {
            // Messages are immutable; retain a committed status message if an earlier read finishes later.
            setMessages(current => Array.from(new Map([...current, ...(payload.messages || [])].map(message => [message.id, message])).values()).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)))
        }
    }, [])

    useEffect(() => { setUserId(getCookie('impersonating_id') || getCookie('id') || '') }, [])
    useEffect(() => {
        const controller = new AbortController()
        if (!initialMessagesLoaded.current) {
            initialMessagesLoaded.current = true
            if (initialChat?.selectedId === selectedId && initialChat.messagesLoaded) {
                setSyncedId(selectedId)
                return () => controller.abort()
            }
        }
        if (initialChat?.selectedId !== selectedId) setMessages([])
        setSyncedId('')
        const refresh = () => { void loadMessages(selectedId, controller.signal).then(() => { if (!controller.signal.aborted) { setError(''); setSyncedId(selectedId) } }).catch(error => { if (!controller.signal.aborted) setError(error.message) }) }
        refresh()
        return () => controller.abort()
    }, [initialChat?.selectedId, loadMessages, selectedId])

    const connection = useSupportLive(async () => {
        const id = selectedRef.current
        setSyncedId('')
        try {
            const [updatedTickets] = await Promise.all([loadTickets(), loadMessages(id)])
            setError(''); setSyncedId(id)
            return realtime.current && (isSupportRef.current || Boolean(updatedTickets?.some(ticket => ticket.status === 'open')))
        } catch (error) { setError(error instanceof Error ? error.message : 'Reconnecting…') }
        finally { setLoading(false) }
    }, false, !signedOut)
    const unread = useSupportUnread(tickets, selectedId, readSelectedId === selectedId && syncedId === selectedId && !error, `user:${userId}`)
    useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages])

    function selectChat(id: string) {
        drafts.current[selectedId] = input
        creating.current = !id
        setReadSelectedId(id)
        selectedRef.current = id
        setSelectedId(id)
        setInput(drafts.current[id] || '')
        setMessages([])
        setError('')
    }

    return {
        tickets, setTickets, selectedId, setSelectedId, selectedRef, ticketRevision, messageRevision, creating, drafts,
        messages, setMessages, readSelectedId, setReadSelectedId, input, setInput, isSupport, error, setError,
        loading, setLoading, syncedId, setSyncedId, signedOut, userId, log, connection, unread, loadTickets,
        loadMessages, selectChat,
    }
}
