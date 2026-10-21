import { expect, mock, test } from 'bun:test'

let authenticated = true
const calls: unknown[][] = []
const page = { messages: [{ id: 'match' }], nextCursor: null }
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: authenticated ? 'actor' : null }) }))
mock.module('#utils/mail/accounts.ts', () => ({ getMailAccess: async (actor: string, mailboxUser?: string) => ({ actorId: actor, targetUser: mailboxUser || actor, username: 'mail-user', password: 'secret' }) }))
mock.module('#utils/mail/config.ts', () => ({
    isMailAdminConfigError: () => false,
    mailAdminUnavailablePayload: () => ({ error: 'unavailable' }),
    mailConfig: { host: 'mail.example.test', domain: 'example.test' },
}))
mock.module('#utils/mail/shared.ts', () => ({ MailAccessDenied: class extends Error {} }))
mock.module('#utils/mail/jmap.ts', () => ({ searchMessagePage: async (...args: unknown[]) => { calls.push(args); return page } }))
const { default: getMailSearch } = await import('../src/handlers/mail/getSearch.ts')

function reply() {
    const state: { status: number, headers: Record<string, string>, body?: unknown } = { status: 200, headers: {} }
    const response = {
        status(value: number) { state.status = value; return response },
        header(name: string, value: string) { state.headers[name] = value; return response },
        send(value: unknown) { state.body = value; return state },
    }
    return { response, state }
}

test('search authorizes the mailbox owner, forwards query and cursor, and disables caching', async () => {
    const { response, state } = reply()
    await getMailSearch({ query: { mailboxUser: 'owner', mailboxId: 'inbox', query: ' invoice ', after: 'cursor' }, log: { info() {} } } as never, response as never)
    expect(calls).toEqual([['mail-user', 'secret', 'inbox', 'invoice', 'cursor']])
    expect(state.body).toBe(page)
    expect(state.headers['Cache-Control']).toContain('no-store')
})

test('search rejects missing mailbox or query and unauthenticated requests', async () => {
    const invalid = reply()
    await getMailSearch({ query: { mailboxId: 'inbox', query: ' ' } } as never, invalid.response as never)
    expect(invalid.state.status).toBe(400)

    authenticated = false
    const unauthorized = reply()
    await getMailSearch({ query: { mailboxId: 'inbox', query: 'invoice' } } as never, unauthorized.response as never)
    expect(unauthorized.state.status).toBe(401)
    authenticated = true
})
