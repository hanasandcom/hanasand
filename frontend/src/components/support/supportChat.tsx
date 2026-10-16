'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PublicSupportPanel } from './publicSupportChat'
import { SupportTicketList } from './supportTicketList'
import { SupportConversation } from './supportConversation'
import { filterTickets } from './supportTicketFilters'
import { useSupportChatFilters } from './useSupportChatFilters'
import { useSupportChatOperations } from './useSupportChatOperations'
import { useSupportChatSession } from './useSupportChatSession'
import type { InitialChat, TicketFilters } from './supportChatTypes'

export default function SupportChat({ embedded = false, initialChat }: { embedded?: boolean; initialChat?: InitialChat }) {
    const filterControlsRef = useRef<TicketFilters>({ search: '', status: 'open', stars: 'all', feedback: 'all', from: '', to: '' })
    const session = useSupportChatSession(initialChat, filterControlsRef)
    const filters = useSupportChatFilters({
        isSupport: session.isSupport,
        initialSupport: initialChat?.isSupport === true,
        loadTickets: session.loadTickets,
        setError: session.setError,
        filterControlsRef,
    })
    const [subject, setSubject] = useState('')
    const operations = useSupportChatOperations(session, subject)
    const {
        tickets, selectedId, messages, input, setInput, isSupport, error, loading, signedOut,
        userId, log, connection, unread, selectChat,
    } = session
    const {
        filtersOpen, setFiltersOpen, filterText, setFilterText, statusFilter, setStatusFilter,
        starFilter, setStarFilter, feedbackFilter, setFeedbackFilter, dateFrom, setDateFrom,
        dateTo, setDateTo,
    } = filters
    const {
        sending, updatingStatus, statusChange, statusError, discordLinkCode, discordLinkExpiry,
        discordLinkBusy, discordLinkError, send, updateStatus, sendFeedback, createDiscordLinkCode,
    } = operations

    if (signedOut) return <PublicSupportPanel />
    if (embedded && loading) return <section aria-label='Support chat' aria-busy='true' className='grid min-h-0 min-w-0 place-items-center'><Loader2 className='site-loading-icon' aria-hidden='true' /></section>

    const displayedTickets = tickets.map(ticket => ticket.id === statusChange?.id
        ? { ...ticket, status: statusChange.status, ...(statusChange.status === 'closed' ? { feedback_rating: null, feedback_comment: null } : {}) }
        : ticket)
    const visibleTickets = filterTickets(displayedTickets, { status: statusFilter, stars: starFilter, feedback: feedbackFilter, from: dateFrom, to: dateTo })
    const hasFilters = Boolean(filterText.trim() || statusFilter !== 'open' || starFilter !== 'all' || feedbackFilter !== 'all' || dateFrom || dateTo)
    const orderedVisibleTickets = [...visibleTickets].sort((left, right) => Number(Boolean(unread[right.id])) - Number(Boolean(unread[left.id])))
    const selected = displayedTickets.find(ticket => ticket.id === selectedId)
    const shell = embedded
        ? 'grid h-[calc(100dvh-6.5rem)] min-h-[30rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1'
        : 'grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ui-panel'

    function clearFilters() {
        setFilterText('')
        setStatusFilter('open')
        setStarFilter('all')
        setFeedbackFilter('all')
        setDateFrom('')
        setDateTo('')
    }

    return <section className={shell} aria-label='Support chat'>
        {embedded ? <SupportTicketList
            isSupport={isSupport}
            tickets={tickets}
            visibleTickets={visibleTickets}
            orderedVisibleTickets={orderedVisibleTickets}
            unread={unread}
            selectedId={selectedId}
            loading={loading}
            filtersOpen={filtersOpen}
            filterText={filterText}
            statusFilter={statusFilter}
            starFilter={starFilter}
            feedbackFilter={feedbackFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            hasFilters={hasFilters}
            discordLinkBusy={discordLinkBusy}
            discordLinkCode={discordLinkCode}
            discordLinkExpiry={discordLinkExpiry}
            discordLinkError={discordLinkError}
            onSelect={selectChat}
            onToggleFilters={() => setFiltersOpen(open => !open)}
            onFilterText={setFilterText}
            onStatusFilter={setStatusFilter}
            onStarFilter={setStarFilter}
            onFeedbackFilter={setFeedbackFilter}
            onDateFrom={setDateFrom}
            onDateTo={setDateTo}
            onClearFilters={clearFilters}
            onCreateDiscordLink={() => void createDiscordLinkCode()}
        /> : null}
        <SupportConversation
            embedded={embedded}
            tickets={tickets}
            isSupport={isSupport}
            selectedId={selectedId}
            selected={selected}
            selectChat={selectChat}
            statusChange={statusChange}
            updatingStatus={updatingStatus}
            sending={sending}
            updateStatus={updateStatus}
            log={log}
            messages={messages}
            userId={userId}
            connection={connection}
            error={error}
            statusError={statusError}
            sendFeedback={sendFeedback}
            input={input}
            setInput={setInput}
            subject={subject}
            setSubject={setSubject}
            loading={loading}
            send={send}
        />
    </section>
}
