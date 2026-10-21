import type { MailOverview } from '@/utils/mail/types'

export function resolveMailboxPage(first: MailOverview, requestedFolder: string) {
    const inbox = first.mailboxes.find(item => item.role === 'inbox' || item.name.toLowerCase() === 'inbox')
    const selectedFolder = requestedFolder || first.selectedMailboxId || inbox?.id || ''
    return {
        selectedFolder,
        useFirstPage: selectedFolder === (first.selectedMailboxId || ''),
    }
}

export function needsSelectedMessageRequest(page: MailOverview, selectedMessageId: string) {
    return Boolean(selectedMessageId && page.selectedMessage?.id !== selectedMessageId)
}
