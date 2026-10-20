import { afterAll, afterEach, expect, test } from 'bun:test'

const previousFetch = globalThis.fetch
const previousEnvironment = {
    MAIL_INTERNAL_URL: process.env.MAIL_INTERNAL_URL,
    MAIL_JMAP_TIMEOUT_MS: process.env.MAIL_JMAP_TIMEOUT_MS,
}
process.env.MAIL_INTERNAL_URL = 'http://mail.test:8081'
process.env.MAIL_JMAP_TIMEOUT_MS = '100'

const { getMailSession, jmapCall } = await import('../src/utils/mail/jmapSession.ts')

afterEach(() => { globalThis.fetch = previousFetch })
afterAll(() => {
    restoreEnvironment('MAIL_INTERNAL_URL', previousEnvironment.MAIL_INTERNAL_URL)
    restoreEnvironment('MAIL_JMAP_TIMEOUT_MS', previousEnvironment.MAIL_JMAP_TIMEOUT_MS)
})

test('retries a transient close while opening a JMAP session', async () => {
    let attempts = 0
    globalThis.fetch = (async () => {
        attempts++
        if (attempts === 1) throw new TypeError('fetch failed', { cause: new Error('The socket connection was closed unexpectedly.') })
        return Response.json({
            apiUrl: 'https://mail.test/jmap/',
            downloadUrl: 'https://mail.test/download/{accountId}/{blobId}/{name}',
            uploadUrl: 'https://mail.test/upload/{accountId}',
            primaryAccounts: { 'urn:ietf:params:jmap:mail': 'account-1' },
        })
    }) as typeof fetch

    await expect(getMailSession('ada', 'secret')).resolves.toMatchObject({ accountId: 'account-1' })
    expect(attempts).toBe(2)
})

test('retries read-only JMAP calls but never retries writes', async () => {
    let attempts = 0
    globalThis.fetch = (async () => {
        attempts++
        if (attempts === 1) throw new TypeError('fetch failed', { cause: new Error('ECONNRESET') })
        return Response.json({ methodResponses: [['Email/query', { ids: [] }, 'query']] })
    }) as typeof fetch

    const session = {
        apiUrl: 'https://mail.test/jmap/',
        downloadUrl: 'https://mail.test/download/{accountId}/{blobId}/{name}',
        uploadUrl: 'https://mail.test/upload/{accountId}',
    }
    await expect(jmapCall('ada', 'secret', session, [
        ['Email/query', {}, 'query'],
    ])).resolves.toEqual({ ids: [] })
    expect(attempts).toBe(2)

    attempts = 0
    await expect(jmapCall('ada', 'secret', session, [
        ['Email/set', {}, 'update'],
    ])).rejects.toThrow('fetch failed')
    expect(attempts).toBe(1)
})

function restoreEnvironment(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
