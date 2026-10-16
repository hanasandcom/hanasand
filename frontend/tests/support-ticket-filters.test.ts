import { expect, test } from 'bun:test'
import { filterTickets } from '../src/components/support/supportTicketFilters'
import type { Ticket } from '../src/components/support/supportChatTypes'

const tickets: Ticket[] = [
    { id: 'open-rated', subject: 'Billing', status: 'open', updated_at: new Date(2026, 8, 19, 12).toISOString(), created_at: new Date(2026, 8, 19, 12).toISOString(), feedback_rating: 5, feedback_comment: 'Clear answer' },
    { id: 'closed-unrated', subject: 'Login', status: 'closed', updated_at: new Date(2026, 8, 20, 12).toISOString(), created_at: new Date(2026, 8, 20, 12).toISOString(), feedback_rating: null, feedback_comment: '' },
]

test('support ticket filters combine status, rating and written feedback', () => {
    expect(filterTickets(tickets, { status: 'open', stars: 'all', feedback: 'all', from: '', to: '' }).map(ticket => ticket.id)).toEqual(['open-rated'])
    expect(filterTickets(tickets, { status: 'all', stars: '5', feedback: 'comment', from: '', to: '' }).map(ticket => ticket.id)).toEqual(['open-rated'])
    expect(filterTickets(tickets, { status: 'all', stars: 'unrated', feedback: 'none', from: '', to: '' }).map(ticket => ticket.id)).toEqual(['closed-unrated'])
})

test('support ticket date filters include both selected local dates', () => {
    const date = new Date(2026, 8, 19, 12)
    const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    expect(filterTickets(tickets, { status: 'all', stars: 'all', feedback: 'all', from: localDay, to: localDay }).map(ticket => ticket.id)).toEqual(['open-rated'])
})
