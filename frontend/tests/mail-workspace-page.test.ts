// @ts-expect-error Bun supplies this test module at runtime.
import { expect, test } from 'bun:test'
import type { MailOverview } from '../src/utils/mail/types'
import { resolveMailboxPage } from '../src/components/mail/mailWorkspacePage'

function overview(selectedMailboxId: string | null, mailboxId: string | null = 'inbox') {
    return {
        selectedMailboxId,
        mailboxes: mailboxId ? [{ id: mailboxId, name: mailboxId, role: mailboxId === 'inbox' ? 'inbox' : 'sent' }] : [],
    } as MailOverview
}

test('initial load reuses the API-selected mailbox page', () => {
    expect(resolveMailboxPage(overview('sent', 'sent'), '')).toEqual({ selectedFolder: 'sent', useFirstPage: true })
})

test('switching to a different requested mailbox fetches that page', () => {
    expect(resolveMailboxPage(overview('inbox'), 'sent')).toEqual({ selectedFolder: 'sent', useFirstPage: false })
})

test('empty mailbox response does not trigger another overview request', () => {
    expect(resolveMailboxPage(overview(null, null), '')).toEqual({ selectedFolder: '', useFirstPage: true })
})
