import type { Feedback } from './supportFeedback'

export type PublicSupportMessage = {
    id: string
    body: string
    sender_kind: 'user' | 'assistant' | 'support' | 'system'
    sender_name: string
    request_id?: string
}

export type PublicSupportTicket = { id: string; subject: string; reply_count: number; status?: string }

export type PublicSupportSubmission = { requestId: string; message: string; handoff?: boolean; conversationId?: string }

export type PublicSupportConversation = Feedback & {
    id?: string
    tickets?: PublicSupportTicket[]
    agent_name?: string
    channel: 'ai' | 'human'
    status: string
    pending: boolean
    messages: PublicSupportMessage[]
    error?: string
    accepted?: boolean
}

export type PublicSupportChatOptions = {
    active?: boolean
    onUnreadChange?: (count: number) => void
    onResolvedChange?: (resolved: boolean) => void
    initialConversation?: PublicSupportConversation
    initialSelectedId?: string
}
