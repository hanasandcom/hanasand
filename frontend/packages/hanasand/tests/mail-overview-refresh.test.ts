import { expect, test } from 'bun:test'
import { messageIdForOverviewRequest, preserveSelectedMessageDuringRefresh } from '../src/mail/components/mailOverviewRefresh.ts'

const message = { id: 'message-1', subject: 'Open message' } as never
const overview = (mailboxUser: string, selectedMailboxId: string, selectedMessage: unknown) => ({
    actor: { id: 'actor', canAccessAnyMailbox: false, canSend: true },
    mailboxUser,
    mailboxAddress: 'actor@example.test',
    accessibleAccounts: [],
    mailboxes: [],
    selectedMailboxId,
    messages: [],
    selectedMessage,
    filters: [],
    recentRecipients: [],
    health: null,
    settings: { host: 'mail.example.test', imapHost: 'mail.example.test', imapPort: 993, smtpHost: 'mail.example.test', smtpPort: 465, managesievePort: 4190, username: 'actor', address: 'actor@example.test' },
})

test('background overview refresh omits the selected message body request', () => {
    expect(messageIdForOverviewRequest({ silent: true }, 'message-1')).toBeUndefined()
})

test('explicit message opens and mailbox resets keep their requested message IDs', () => {
    expect(messageIdForOverviewRequest({ messageId: 'message-2', silent: true }, 'message-1')).toBe('message-2')
    expect(messageIdForOverviewRequest({ messageId: null }, 'message-1')).toBeNull()
})

test('a background mailbox refresh preserves the open message body for the same mailbox', () => {
    const current = overview('actor', 'inbox', message)
    const next = overview('actor', 'inbox', null)
    expect(preserveSelectedMessageDuringRefresh(current as never, next as never, true).selectedMessage).toBe(message)
})

test('a background mailbox refresh drops a message body after the mailbox changes', () => {
    const current = overview('actor', 'inbox', message)
    const next = overview('actor', 'archive', null)
    expect(preserveSelectedMessageDuringRefresh(current as never, next as never, true).selectedMessage).toBeNull()
})
