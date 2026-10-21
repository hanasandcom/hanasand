import { afterEach, expect, test } from 'bun:test'
import { getMessage, listMessagePage, searchMessagePage } from '../src/utils/mail/jmap'
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
test('mail pages use a stable anchor, preserve query order and expose an end cursor', async () => {
    const queries: Record<string, unknown>[] = []
    const emailRequests: Record<string, unknown>[] = []
    globalThis.fetch = (async (_url, init) => {
        if (!init?.body) return Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        const [method, args] = JSON.parse(String(init.body)).methodCalls[0]
        if (method === 'Email/query') {
            queries.push(args)
            return Response.json({ methodResponses: [[method, { ids: args.anchor ? ['third'] : ['first', 'second', 'third'] }, 'q']] })
        }
        emailRequests.push(args)
        return Response.json({ methodResponses: [[method, { list: args.ids.map((id: string) => ({ id })).reverse() }, 'get']] })
    }) as typeof fetch
    const first = await listMessagePage('user', 'secret', 'inbox', undefined, 2)
    expect(first.messages.map(m => m.id)).toEqual(['first', 'second'])
    expect(first.nextCursor).toBe('second')
    const last = await listMessagePage('user', 'secret', 'inbox', first.nextCursor!, 2)
    expect(last.messages.map(m => m.id)).toEqual(['third'])
    expect(last.nextCursor).toBeNull()
    expect(queries[1]).toMatchObject({ anchor: 'second', anchorOffset: 1, limit: 3, filter: { inMailbox: 'inbox' } })
    expect(emailRequests[0].properties).toEqual([
        'id', 'threadId', 'mailboxIds', 'keywords', 'subject', 'preview', 'receivedAt', 'sentAt', 'from', 'to', 'cc', 'hasAttachment',
    ])
    expect(emailRequests[0]).not.toHaveProperty('fetchAllBodyValues')
})
test('a missing anchor is an error, not a false empty mailbox', async () => {
    globalThis.fetch = (async (_url, init) => !init?.body
        ? Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        : Response.json({ methodResponses: [['error', { type: 'anchorNotFound' }, 'q']] })) as typeof fetch
    await expect(listMessagePage('user', 'secret', 'inbox', 'deleted')).rejects.toThrow('Mail request failed')
})

test('mail search scopes JMAP text search to the selected mailbox and paginates', async () => {
    let queryArgs: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
        if (!init?.body) return Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        const [method, args] = JSON.parse(String(init.body)).methodCalls[0]
        if (method === 'Email/query') {
            queryArgs = args
            return Response.json({ methodResponses: [[method, { ids: ['first', 'second'] }, 'q']] })
        }
        return Response.json({ methodResponses: [[method, { list: args.ids.map((id: string) => ({ id })) }, 'get']] })
    }) as typeof fetch
    const page = await searchMessagePage('user', 'secret', 'inbox', 'invoice', 'first', 1)
    expect(queryArgs).toMatchObject({
        filter: { inMailbox: 'inbox', text: 'invoice' },
        anchor: 'first',
        anchorOffset: 1,
        limit: 2,
    })
    expect(page.messages.map(message => message.id)).toEqual(['first'])
    expect(page.nextCursor).toBe('first')
})

test('opening a message requests its body after the list uses summary properties', async () => {
    let emailRequest: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
        if (!init?.body) return Response.json({ apiUrl: 'http://localhost/jmap', primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account' } })
        const [method, args] = JSON.parse(String(init.body)).methodCalls[0]
        if (method === 'Email/get') {
            emailRequest = args
            return Response.json({ methodResponses: [[method, { list: [{
                id: 'message-1', textBody: [{ partId: 'text' }], bodyValues: { text: { value: 'Message body' } },
            }] }, 'get']] })
        }
        return Response.json({ methodResponses: [[method, { ids: ['message-1'] }, 'query']] })
    }) as typeof fetch

    await expect(getMessage('user', 'secret', 'message-1')).resolves.toMatchObject({ id: 'message-1', textBody: 'Message body' })
    expect(emailRequest?.properties).toContain('bodyValues')
    expect(emailRequest).toMatchObject({ fetchAllBodyValues: true })
})
