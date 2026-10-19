import type { Feedback } from './supportFeedback'

export type Ticket = Feedback & {
    id: string
    subject: string
    status: string
    user_id?: string | null
    user_name?: string
    last_message?: string
    created_at?: string
    updated_at: string
    agent_name?: string
    channel?: string
    reply_count?: number
}

export type Message = {
    id: string
    sender_id: string | null
    sender_kind?: string
    sender_name: string
    body: string
    created_at: string
}

export type StatusFilter = 'open' | 'resolved' | 'all'
export type StarFilter = 'all' | 'rated' | 'unrated' | '1' | '2' | '3' | '4' | '5'
export type FeedbackFilter = 'all' | 'comment' | 'none'

export type InitialChat = {
    tickets: Ticket[]
    isSupport: boolean
    selectedId: string
    messages: Message[]
    messagesLoaded: boolean
    realtime: boolean
}

export type TicketFilters = {
    search: string
    status: StatusFilter
    stars: StarFilter
    feedback: FeedbackFilter
    from: string
    to: string
}
