import type { MailOverview } from '../types.js'

export function messageIdForOverviewRequest(
    params: { messageId?: string | null, silent?: boolean },
    selectedMessageId: string | null,
) {
    if (params.silent && params.messageId === undefined) return undefined
    return params.messageId === undefined ? selectedMessageId : params.messageId
}

export function preserveSelectedMessageDuringRefresh(
    current: MailOverview | null,
    next: MailOverview,
    isBackgroundRefresh: boolean,
): MailOverview {
    if (!isBackgroundRefresh || !current?.selectedMessage) return next
    if (current.mailboxUser !== next.mailboxUser || current.selectedMailboxId !== next.selectedMailboxId) return next
    return { ...next, selectedMessage: current.selectedMessage }
}
