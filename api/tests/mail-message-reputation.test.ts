import { afterEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

const hashLookups: string[] = []
const downloads: string[] = []
const hashCache = new Map<string, string>()
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'actor' }) }))
mock.module('#utils/mail/accounts.ts', () => ({ getMailAccess: async () => ({ targetUser: 'mailbox@example.test', username: 'mail-user', password: 'secret' }) }))
mock.module('#utils/mail/config.ts', () => ({ isMailAdminConfigError: () => false, mailAdminUnavailablePayload: () => ({ error: 'unavailable' }) }))
mock.module('#utils/mail/shared.ts', () => ({ MailAccessDenied: class extends Error {} }))
mock.module('#utils/mail/jmap.ts', () => ({
    getMailSession: async () => ({ session: {}, accountId: 'account' }),
    downloadBlobWithSession: async (_username: string, _password: string, _session: unknown, _accountId: string, blobId: string) => {
        downloads.push(blobId)
        return new Response(new Uint8Array([1, 2, 3, 4]))
    },
    getMessage: async () => ({
        id: 'message-1', htmlBody: '<img src="https://example.test/pixel.png">',
        attachments: [
            { blobId: 'small-blob', name: 'small.png', size: 4 },
            { blobId: 'large-blob', name: 'large.bin', size: 101 * 1024 * 1024 },
        ],
    }),
}))
mock.module('#utils/mail/urlReputation.ts', () => ({
    extractRemoteUrls: (html: string) => html.includes('example.test') ? [{ id: 'url-hash', url: 'https://example.test/pixel.png' }] : [],
    cachedAttachmentSha256: async (_mailboxUser: string, blobId: string) => hashCache.get(blobId) || null,
    cacheAttachmentSha256: async (_mailboxUser: string, blobId: string, sha256: string) => { hashCache.set(blobId, sha256) },
    lookupUrlReputation: async () => ({ provider: 'virustotal', status: 'known', flagged: 0, total: 90 }),
    lookupFileHashReputation: async (sha256: string) => {
        hashLookups.push(sha256)
        return { provider: 'virustotal', status: 'known', flagged: 1, total: 90 }
    },
}))

const { default: getMessageReputation } = await import('../src/handlers/mail/getMessageReputation.ts')

afterEach(() => {
    hashLookups.length = 0
    downloads.length = 0
    hashCache.clear()
})

test('checks bounded attachment hashes and returns each reputation with message metadata', async () => {
    const state = await invoke()

    expect(state.status).toBe(200)
    expect(downloads).toEqual(['small-blob'])
    expect(hashLookups).toHaveLength(1)
    expect(state.body).toMatchObject({
        messageId: 'message-1',
        remoteUrls: [{ id: 'url-hash', reputation: { status: 'known', flagged: 0 } }],
        attachments: [
            { blobId: 'small-blob', reputation: { status: 'known', flagged: 1, total: 90 } },
            { blobId: 'large-blob', reputation: { status: 'unavailable' } },
        ],
    })
    await invoke()
    expect(downloads).toEqual(['small-blob'])
})

async function invoke() {
    const state: { body?: unknown, status: number } = { status: 200 }
    const res = {
        status(value: number) { state.status = value; return this },
        header() { return this },
        send(value: unknown) { state.body = value; return state },
    } as unknown as FastifyReply
    await getMessageReputation({ params: { id: 'message-1' }, query: { mailboxUser: 'mailbox@example.test' }, log: { error() {} } } as unknown as FastifyRequest, res)
    return state
}
