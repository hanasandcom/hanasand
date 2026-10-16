import type { FeedbackFilter, StarFilter, StatusFilter, Ticket } from './supportChatTypes'

export function matchesStatusFilter(ticket: Ticket, filter: StatusFilter) {
    if (filter === 'open') return ticket.status !== 'closed'
    if (filter === 'resolved') return ticket.status === 'closed'
    return true
}

export function localDateKey(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function filterTickets(tickets: Ticket[], filters: {
    status: StatusFilter
    stars: StarFilter
    feedback: FeedbackFilter
    from: string
    to: string
}) {
    return tickets.filter(ticket => {
        if (!matchesStatusFilter(ticket, filters.status)) return false
        if (filters.stars === 'rated' && !ticket.feedback_rating) return false
        if (filters.stars === 'unrated' && ticket.feedback_rating) return false
        if (/^[1-5]$/.test(filters.stars) && ticket.feedback_rating !== Number(filters.stars)) return false
        const hasComment = Boolean(ticket.feedback_comment?.trim())
        if (filters.feedback === 'comment' && !hasComment) return false
        if (filters.feedback === 'none' && hasComment) return false
        if (filters.from || filters.to) {
            const date = localDateKey(ticket.created_at || ticket.updated_at)
            if (!date || (filters.from && date < filters.from) || (filters.to && date > filters.to)) return false
        }
        return true
    })
}
