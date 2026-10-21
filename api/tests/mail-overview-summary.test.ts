import { expect, mock, test } from 'bun:test'

const messageReads: string[] = []
const sessionsUsed: unknown[] = []
const mailboxSession = { apiUrl: 'https://mail.example.test/jmap' }
const access = {
    targetUser: 'actor', username: 'mail-user', password: 'secret', address: 'actor@example.test',
    canAccessAnyMailbox: false, canSend: true,
}

mock.module('#utils/mail/filters.ts', () => ({
    listMailRules: async () => [],
    scheduleMailRules: () => {},
}))
mock.module('#utils/mail/jmap.ts', () => ({
    getMailboxList: async () => ({ accountId: 'account', session: mailboxSession, mailboxes: [{ id: 'inbox', role: 'inbox', unreadEmails: 4 }] }),
    getMessageWithSession: async (_username: string, _password: string, session: unknown, _accountId: string, id: string) => {
        sessionsUsed.push(session)
        messageReads.push(id)
        return { id, subject: 'Opened message' }
    },
    listMessagePageWithSession: async (_username: string, _password: string, session: unknown) => {
        sessionsUsed.push(session)
        return { messages: [{ id: 'first' }, { id: 'second' }], nextCursor: null }
    },
}))
mock.module('#utils/mail/config.ts', () => ({ mailConfig: { host: 'mail.example.test', imapPort: 993, smtpPort: 465, managesievePort: 4190 } }))
mock.module('#utils/mail/accounts.ts', () => ({
    rotateMailPasswordForUser: async () => { throw new Error('Unexpected credential repair') },
    listAccessibleMailAccounts: async () => [],
}))
mock.module('#utils/mail/recentRecipients.ts', () => ({ listRecentRecipients: async () => [] }))

const { loadMailboxOverviewData } = await import('../src/handlers/mail/overviewData.ts')

const params = {
    actorId: 'actor', access,
    health: null, accessibleAccounts: [], recentRecipients: [],
    onRepair: () => {}, onRulesError: () => {},
}

test('overview returns message summaries without reading a message body', async () => {
    const overview = await loadMailboxOverviewData({ ...params, query: {} })

    expect(overview.messages.map(message => message.id)).toEqual(['first', 'second'])
    expect(overview.selectedMessage).toBeNull()
    expect(messageReads).toEqual([])
    expect(sessionsUsed).toEqual([mailboxSession])
})

test('overview reads full message details only for an explicitly opened message', async () => {
    const overview = await loadMailboxOverviewData({ ...params, query: { messageId: 'second' } })

    expect(overview.selectedMessage).toMatchObject({ id: 'second' })
    expect(messageReads).toEqual(['second'])
    expect(sessionsUsed.slice(-2)).toEqual([mailboxSession, mailboxSession])
})
