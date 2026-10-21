import { expect, mock, test } from 'bun:test'

const messageReads: string[] = []
const access = {
    targetUser: 'actor', username: 'mail-user', password: 'secret', address: 'actor@example.test',
    canAccessAnyMailbox: false, canSend: true,
}

mock.module('#utils/mail/filters.ts', () => ({
    listMailRules: async () => [],
    scheduleMailRules: () => {},
}))
mock.module('#utils/mail/jmap.ts', () => ({
    getMailboxList: async () => ({ mailboxes: [{ id: 'inbox', role: 'inbox' }] }),
    getMessage: async (_username: string, _password: string, id: string) => {
        messageReads.push(id)
        return { id, subject: 'Opened message' }
    },
    listMessagePage: async () => ({ messages: [{ id: 'first' }, { id: 'second' }], nextCursor: null }),
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
})

test('overview reads full message details only for an explicitly opened message', async () => {
    const overview = await loadMailboxOverviewData({ ...params, query: { messageId: 'second' } })

    expect(overview.selectedMessage).toMatchObject({ id: 'second' })
    expect(messageReads).toEqual(['second'])
})
