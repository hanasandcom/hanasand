import { afterEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'

type RecordRow = {
    status: string
    payload_hash: string
    response_status: number | null
    response_body: Record<string, unknown> | null
    error_message: string | null
}
const records = new Map<string, RecordRow>()
let smtpCalls = 0
let smtpFailure: Error | null = null

function recordKey(values: unknown[]) { return `${values[0]}\0${values[1]}\0${values[2]}` }
async function query(sql: string, values: unknown[] = []) {
    const key = recordKey(values)
    if (sql.includes('INSERT INTO mail_send_idempotency')) {
        if (records.has(key)) return { rows: [] }
        const row = { status: 'processing', payload_hash: values[3] as string, response_status: null, response_body: null, error_message: null }
        records.set(key, row)
        return { rows: [row] }
    }
    if (sql.includes('SELECT status, payload_hash')) return { rows: records.has(key) ? [records.get(key)] : [] }
    if (sql.includes('UPDATE mail_send_idempotency')) {
        const row = records.get(key)
        if (row && (!sql.includes('status = \'processing\'') || row.status === 'processing')) {
            if (sql.includes('status = \'sent\'')) row.response_body = JSON.parse(String(values[3]))
            else {
                row.status = String(values[3])
                row.response_status = Number(values[4])
                row.response_body = JSON.parse(String(values[5]))
                row.error_message = String(values[6] || '') || null
            }
        }
        return { rows: [] }
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
}

mock.module('#db', () => ({ default: query, withTransaction: async (work: (run: typeof query) => unknown) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'actor' }) }))
mock.module('#utils/mail/accounts.ts', () => ({ getMailAccess: async (_actor: string, mailbox?: string) => ({ targetUser: mailbox || 'actor', username: 'mail-user', address: 'actor@example.test', password: 'secret', canSend: true }) }))
mock.module('#utils/mail/config.ts', () => ({
    mailConfig: {},
    requireMailAdminConfig: () => ({}),
    isMailAdminConfigError: () => false,
    isMailServiceConnectionError: () => false,
    mailAdminUnavailablePayload: () => ({ error: 'not configured' }),
    mailServiceUnavailablePayload: () => ({ error: 'service unavailable' }),
}))
mock.module('#utils/mail/helpers.ts', () => ({ parseAddressInput: (value: string) => value ? [{ email: value }] : [] }))
mock.module('#utils/mail/jmap.ts', () => ({
    storeSentMessage: async () => ({ sentMailboxId: 'sent-box', sentMessageId: 'sent-message' }),
    uploadAttachment: async () => ({ blobId: 'blob', size: 1, type: 'text/plain' }),
}))
mock.module('#utils/mail/recentRecipients.ts', () => ({ rememberRecentRecipients: async () => undefined }))
mock.module('#utils/mail/smtp.ts', () => ({ sendMailViaSmtp: async () => {
    smtpCalls += 1
    if (smtpFailure) throw smtpFailure
    return { messageId: 'smtp-message' }
} }))

const { default: postSendMail } = await import('../src/handlers/mail/postSend.ts')

afterEach(() => {
    records.clear()
    smtpCalls = 0
    smtpFailure = null
})

test('replays the stored successful response without sending a duplicate', async () => {
    const first = await invoke()
    const replay = await invoke()
    expect(first.statusCode).toBe(201)
    expect(replay.payload).toEqual(first.payload)
    expect(smtpCalls).toBe(1)
})

test('rejects reuse of one key with a different payload', async () => {
    const first = await invoke()
    const conflict = await invoke({ subject: 'Changed subject' })
    expect(first.statusCode).toBe(201)
    expect(conflict.statusCode).toBe(409)
    expect(conflict.payload).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    expect(smtpCalls).toBe(1)
})

test('does not resend after an ambiguous SMTP failure', async () => {
    smtpFailure = new Error('Connection reset after DATA')
    const first = await invoke()
    smtpFailure = null
    const retry = await invoke()
    expect(first.statusCode).toBe(502)
    expect(first.payload).toMatchObject({ code: 'MAIL_SEND_OUTCOME_UNKNOWN', retryable: false })
    expect(retry.statusCode).toBe(502)
    expect(retry.payload).toEqual(first.payload)
    expect(smtpCalls).toBe(1)
})

async function invoke(overrides: Record<string, unknown> = {}) {
    const req = {
        body: { to: 'recipient@example.test', subject: 'Hello', textBody: 'Body', ...overrides },
        headers: { 'idempotency-key': 'mail-send-stable-key-0001' },
        log: { error() {}, warn() {} },
    } as unknown as FastifyRequest
    const replyState = { statusCode: 200, headers: {} as Record<string, string>, payload: undefined as unknown }
    const res = {
        status(code: number) { replyState.statusCode = code; return this },
        header(name: string, value: string) { replyState.headers[name.toLowerCase()] = value; return this },
        send(payload: unknown) { replyState.payload = payload; return replyState },
    } as unknown as FastifyReply
    return await postSendMail(req, res) as typeof replyState
}
