import { useRef, useState, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from 'react'
import { supportFetch } from '@/utils/support/api'
import type { Message, Ticket } from './supportChatTypes'

type Session = {
    selectedId: string
    selectedRef: MutableRefObject<string>
    ticketRevision: MutableRefObject<number>
    creating: MutableRefObject<boolean>
    setSelectedId: Dispatch<SetStateAction<string>>
    tickets: Ticket[]
    setTickets: Dispatch<SetStateAction<Ticket[]>>
    messages: Message[]
    setMessages: Dispatch<SetStateAction<Message[]>>
    input: string
    setInput: Dispatch<SetStateAction<string>>
    setError: Dispatch<SetStateAction<string>>
    loadTickets: () => Promise<Ticket[] | undefined>
    loadMessages: (id: string, signal?: AbortSignal) => Promise<void>
}

export function useSupportChatOperations(session: Session, subject: string) {
    const [sending, setSending] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [statusChange, setStatusChange] = useState<{ id: string; status: 'open' | 'closed' } | null>(null)
    const statusPending = useRef(false)
    const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null)
    const [discordLinkCode, setDiscordLinkCode] = useState('')
    const [discordLinkExpiry, setDiscordLinkExpiry] = useState('')
    const [discordLinkBusy, setDiscordLinkBusy] = useState(false)
    const [discordLinkError, setDiscordLinkError] = useState('')

    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const body = session.input.trim()
        if (!body || sending || statusPending.current) return
        setSending(true)
        session.setError('')
        try {
            const response = session.selectedId
                ? await supportFetch(`/support/tickets/${encodeURIComponent(session.selectedId)}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: body }) })
                : await supportFetch('/support/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: subject.trim() || 'Support question', message: body }) })
            if (!response.ok) throw new Error('We could not send that message. Please try again.')
            const payload = await response.json() as { id?: string }
            session.setInput('')
            if (payload.id) {
                session.creating.current = false
                session.selectedRef.current = payload.id
                // State updates select the new chat; refs are updated immediately for overlapping realtime reads.
                session.setSelectedId(payload.id)
            } else await session.loadMessages(session.selectedId)
            await session.loadTickets()
        } catch (error) {
            session.setError(error instanceof Error ? error.message : 'We could not send that message. Please try again.')
        } finally { setSending(false) }
    }

    async function updateStatus(status: 'open' | 'closed') {
        if (statusPending.current) return
        statusPending.current = true
        const id = session.selectedId
        ++session.ticketRevision.current
        setStatusChange({ id, status }); setUpdatingStatus(true); setStatusError(null); session.setError('')
        try {
            const response = await supportFetch(`/support/tickets/${encodeURIComponent(id)}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
            const payload = await response.json() as { error?: string; ticket?: Partial<Ticket> & { id: string }; message?: Message }
            if (!response.ok) throw new Error(payload.error || 'Could not update this chat.')
            if (payload.ticket?.id === id) {
                ++session.ticketRevision.current
                session.setTickets(current => current.map(ticket => ticket.id === id ? { ...ticket, ...payload.ticket, ...(payload.message ? { last_message: payload.message.body } : {}) } : ticket))
                const message = payload.message
                if (session.selectedRef.current === id && message) {
                    session.setMessages(current => current.some(existing => existing.id === message.id) ? current : [...current, message])
                }
            } else await Promise.all([session.loadTickets(), session.loadMessages(id)])
        } catch (error) {
            setStatusError({ id, message: error instanceof Error ? error.message : 'Could not update this chat.' })
            const refreshed = await session.loadTickets().catch(() => undefined)
            if (refreshed?.some(ticket => ticket.id === id && ticket.status === status)) setStatusError(null)
        } finally { statusPending.current = false; setStatusChange(null); setUpdatingStatus(false) }
    }

    async function sendFeedback(rating: number, comment: string) {
        const id = session.selectedId
        const version = session.tickets.find(ticket => ticket.id === id)?.resolution_version
        session.ticketRevision.current += 1
        const response = await supportFetch(`/support/tickets/${encodeURIComponent(id)}/feedback`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating, comment, resolutionVersion: version }) })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not save feedback.')
        session.ticketRevision.current += 1
        session.setTickets(current => current.map(ticket => ticket.id === id && ticket.resolution_version === version && ticket.status === 'closed'
            ? { ...ticket, feedback_rating: rating, feedback_comment: comment } : ticket))
    }

    async function createDiscordLinkCode() {
        if (discordLinkBusy) return
        setDiscordLinkBusy(true); setDiscordLinkError(''); setDiscordLinkCode('')
        try {
            const response = await supportFetch('/support/discord/link-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
            const payload = await response.json() as { code?: string; expiresAt?: string; error?: string }
            if (!response.ok || !payload.code) throw new Error(payload.error || 'Could not create a Discord link code.')
            setDiscordLinkCode(payload.code)
            setDiscordLinkExpiry(payload.expiresAt || '')
        } catch (error) {
            setDiscordLinkError(error instanceof Error ? error.message : 'Could not create a Discord link code.')
        } finally { setDiscordLinkBusy(false) }
    }

    return { sending, updatingStatus, statusChange, statusError, discordLinkCode, discordLinkExpiry, discordLinkBusy, discordLinkError, send, updateStatus, sendFeedback, createDiscordLinkCode }
}
