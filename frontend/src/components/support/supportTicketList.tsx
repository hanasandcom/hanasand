import Image from 'next/image'
import { BellDot, ListFilter, Search } from 'lucide-react'
import { SupportStars } from './supportFeedback'
import { supportFieldClass } from './supportChatStyles'
import type { FeedbackFilter, StarFilter, StatusFilter, Ticket } from './supportChatTypes'

export function SupportTicketList({
    isSupport, tickets, visibleTickets, orderedVisibleTickets, unread, selectedId, loading, filtersOpen,
    filterText, statusFilter, starFilter, feedbackFilter, dateFrom, dateTo, hasFilters,
    discordLinkBusy, onSelect, onToggleFilters, onFilterText, onStatusFilter, onStarFilter,
    onFeedbackFilter, onDateFrom, onDateTo, onClearFilters, onCreateDiscordLink,
    discordLinkCode, discordLinkExpiry, discordLinkError,
}: {
    isSupport: boolean
    tickets: Ticket[]
    visibleTickets: Ticket[]
    orderedVisibleTickets: Ticket[]
    unread: Record<string, number>
    selectedId: string
    loading: boolean
    filtersOpen: boolean
    filterText: string
    statusFilter: StatusFilter
    starFilter: StarFilter
    feedbackFilter: FeedbackFilter
    dateFrom: string
    dateTo: string
    hasFilters: boolean
    discordLinkBusy: boolean
    discordLinkCode: string
    discordLinkExpiry: string
    discordLinkError: string
    onSelect: (id: string) => void
    onToggleFilters: () => void
    onFilterText: (value: string) => void
    onStatusFilter: (value: StatusFilter) => void
    onStarFilter: (value: StarFilter) => void
    onFeedbackFilter: (value: FeedbackFilter) => void
    onDateFrom: (value: string) => void
    onDateTo: (value: string) => void
    onClearFilters: () => void
    onCreateDiscordLink: () => void
}) {
    return <aside className='relative flex min-h-0 min-w-0 flex-col border-b border-ui-border bg-ui-raised lg:border-b-0 lg:border-r'>
        <div className='flex min-h-20 flex-col justify-center gap-1 border-b border-ui-border px-4 py-3'>
            <div className='flex w-full items-center justify-between gap-2'>
                <h1 className='text-sm font-semibold text-ui-text'>{isSupport ? 'Support' : 'Your support chats'}</h1>
                <div className='flex shrink-0 items-center gap-1'>
                    {isSupport ? <div>
                        <button type='button' aria-label='Filter support chats' aria-expanded={filtersOpen} onClick={onToggleFilters}
                            className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ui-border transition hover:bg-ui-panel focus-visible:outline-2 focus-visible:outline-ui-primary ${filtersOpen || hasFilters ? 'text-ui-primary' : 'text-ui-muted'}`}>
                            <ListFilter aria-hidden='true' className='h-4 w-4' />
                            {hasFilters ? <span className='absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ui-primary' /> : null}
                        </button>
                        {filtersOpen ? <SupportTicketFilters {...{ filterText, statusFilter, starFilter, feedbackFilter, dateFrom, dateTo, hasFilters, visibleTickets, tickets }} onFilterText={onFilterText} onStatusFilter={onStatusFilter} onStarFilter={onStarFilter} onFeedbackFilter={onFeedbackFilter} onDateFrom={onDateFrom} onDateTo={onDateTo} onClearFilters={onClearFilters} /> : null}
                    </div> : null}
                    <button type='button' disabled={discordLinkBusy} onClick={onCreateDiscordLink} aria-label={discordLinkBusy ? 'Creating Discord link code' : 'Connect Discord'} title='Connect Discord' className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ui-border transition hover:bg-ui-panel focus-visible:outline-2 focus-visible:outline-ui-primary disabled:opacity-50'>
                        <Image src='/images/assets/social/discord.svg' alt='' aria-hidden='true' width={16} height={16} className='h-4 w-4 object-contain' />
                    </button>
                </div>
            </div>
            {!isSupport ? <p className='text-xs text-ui-muted'>Conversations with the support team.</p> : null}
        </div>
        {discordLinkCode || discordLinkError ? <div className='grid gap-2 border-b border-ui-border px-4 py-3'>
            {discordLinkCode ? <p role='status' className='text-xs leading-5 text-ui-muted'>In Discord, run <span className='font-medium text-ui-text'>/tickets</span>, choose <span className='font-medium text-ui-text'>Link account</span>, then enter <code className='select-all rounded bg-ui-panel px-1.5 py-0.5 font-mono text-ui-text'>{discordLinkCode}</code>. Code expires {new Date(discordLinkExpiry).toLocaleTimeString()}.</p> : null}
            {discordLinkError ? <p role='alert' className='text-xs text-ui-text'>{discordLinkError}</p> : null}
        </div> : null}
        {!isSupport ? <button type='button' onClick={() => onSelect('')} className='mx-4 mb-2 rounded-lg border border-ui-border px-3 py-2 text-xs font-medium text-ui-primary hover:bg-ui-panel'>New chat</button> : null}
        <div className='max-h-36 overflow-y-auto p-2 lg:max-h-none lg:flex-1'>
            {orderedVisibleTickets.map(ticket => <TicketButton key={ticket.id} ticket={ticket} selected={selectedId === ticket.id} unread={unread[ticket.id] || 0} isSupport={isSupport} onSelect={onSelect} />)}
            {!visibleTickets.length && !loading ? <p className='p-2 text-xs text-ui-muted'>{tickets.length ? 'No chats match these filters.' : 'No support chats yet.'}</p> : null}
        </div>
    </aside>
}

function SupportTicketFilters({ filterText, statusFilter, starFilter, feedbackFilter, dateFrom, dateTo, hasFilters, visibleTickets, tickets, onFilterText, onStatusFilter, onStarFilter, onFeedbackFilter, onDateFrom, onDateTo, onClearFilters }: {
    filterText: string; statusFilter: StatusFilter; starFilter: StarFilter; feedbackFilter: FeedbackFilter; dateFrom: string; dateTo: string; hasFilters: boolean; visibleTickets: Ticket[]; tickets: Ticket[]
    onFilterText: (value: string) => void; onStatusFilter: (value: StatusFilter) => void; onStarFilter: (value: StarFilter) => void; onFeedbackFilter: (value: FeedbackFilter) => void; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onClearFilters: () => void
}) {
    return <div role='dialog' aria-label='Filter support chats' className='absolute left-2 right-2 top-20 z-30 grid max-h-[calc(100dvh-14rem)] gap-3 overflow-y-auto overscroll-contain rounded-xl border border-ui-border bg-ui-panel p-4 shadow-xl'>
        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Search text
            <span className='relative'><Search aria-hidden='true' className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' /><input aria-label='Search support tickets' type='search' value={filterText} onChange={event => onFilterText(event.target.value)} placeholder='Search conversations…' className={`${supportFieldClass} w-full pl-9`} /></span>
        </label>
        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Status<select aria-label='Filter by status' value={statusFilter} onChange={event => onStatusFilter(event.target.value as StatusFilter)} className={supportFieldClass}><option value='open'>Open</option><option value='resolved'>Resolved</option><option value='all'>All chats</option></select></label>
        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Stars<select aria-label='Filter by stars' value={starFilter} onChange={event => onStarFilter(event.target.value as StarFilter)} className={supportFieldClass}><option value='all'>Any rating</option><option value='rated'>Has a star rating</option><option value='unrated'>No star rating</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} stars</option>)}</select></label>
        <div className='grid grid-cols-2 gap-2'><label className='grid gap-1.5 text-xs font-medium text-ui-muted'>From<input aria-label='Filter from date' type='date' value={dateFrom} max={dateTo || undefined} onChange={event => onDateFrom(event.target.value)} className={supportFieldClass} /></label><label className='grid gap-1.5 text-xs font-medium text-ui-muted'>To<input aria-label='Filter to date' type='date' value={dateTo} min={dateFrom || undefined} onChange={event => onDateTo(event.target.value)} className={supportFieldClass} /></label></div>
        <label className='grid gap-1.5 text-xs font-medium text-ui-muted'>Written feedback<select aria-label='Filter by written feedback' value={feedbackFilter} onChange={event => onFeedbackFilter(event.target.value as FeedbackFilter)} className={supportFieldClass}><option value='all'>Any</option><option value='comment'>Has a comment</option><option value='none'>No comment</option></select></label>
        <div className='flex items-center justify-between gap-3 border-t border-ui-border pt-3'><p role='status' className='text-xs text-ui-muted'>{visibleTickets.length} of {tickets.length} chats</p><button type='button' disabled={!hasFilters} onClick={onClearFilters} className='rounded-md px-2 py-1 text-xs font-medium text-ui-primary hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-50'>Clear filters</button></div>
    </div>
}

function TicketButton({ ticket, selected, unread, isSupport, onSelect }: { ticket: Ticket; selected: boolean; unread: number; isSupport: boolean; onSelect: (id: string) => void }) {
    return <button type='button' aria-pressed={selected} onClick={() => onSelect(ticket.id)} className={`grid w-full min-w-0 gap-1 rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-ui-primary ${selected ? 'bg-ui-primary/10' : 'hover:bg-ui-panel'}`}>
        <span className='flex min-w-0 items-center gap-2'>{unread ? <BellDot role='img' aria-label='Unread messages' className='h-4 w-4 shrink-0 text-ui-primary' /> : null}<span className='truncate text-sm font-semibold text-ui-text'>{isSupport && ticket.user_name !== 'Visitor' ? ticket.user_name || ticket.subject : ticket.subject}</span></span>
        {ticket.status === 'closed' || ticket.feedback_rating ? <span className='flex flex-wrap items-center gap-2'>{ticket.status === 'closed' ? <span className='rounded-md border border-ui-success/30 bg-ui-success/10 px-2 py-0.5 text-[11px] font-medium text-ui-success'>Resolved</span> : null}{ticket.feedback_rating ? <SupportStars rating={ticket.feedback_rating} /> : null}</span> : null}
        {unread ? <span role='status' aria-label={`${unread} unread replies`} className='w-fit rounded-full bg-ui-primary px-2 py-0.5 text-[11px] text-ui-on-primary'>{unread}</span> : null}
        <span className='truncate text-xs text-ui-muted'>{ticket.last_message || 'No messages yet'}</span>
    </button>
}
