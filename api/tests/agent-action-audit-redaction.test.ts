import { expect, mock, test } from 'bun:test'

const auditQueries: Array<{ sql: string; params: unknown[] }> = []
mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        auditQueries.push({ sql, params })
        return { rows: [] }
    },
}))

const { auditAgentAction } = await import('../src/utils/ai/actionPolicy.ts')

test('audit redacts sensitive values in nested metadata', async () => {
    auditQueries.length = 0
    await auditAgentAction({ headers: {}, log: { error() {} } } as never, {
        action: 'http_request',
        metadata: {
            nested: {
                apiToken: 'example-secret',
                authorization: 'Bearer eyJ.example.signature',
                cookie: 'session=example-cookie',
                sessionId: 'example-session',
                safe: 'kept',
            },
            notes: ['password=example-password', 'Authorization: Bearer example-token', 'Bearer standalone-token', 'ordinary note'],
            requests: [{ cookieHeader: 'session=another-example-cookie' }],
        },
    }, {
        status: 'allowed', risk: 'low', reason: 'Allowed.', hardBlock: false, safeAlternative: 'Proceed.',
    })

    const insert = auditQueries.find(query => query.sql.includes('INSERT INTO ai_agent_action_audit'))
    expect(insert).toBeDefined()
    const storedMetadata = JSON.parse(String(insert!.params[12]))
    expect(storedMetadata).toEqual({
        nested: {
            apiToken: '[redacted]',
            authorization: '[redacted]',
            cookie: '[redacted]',
            sessionId: '[redacted]',
            safe: 'kept',
        },
        notes: ['password=[redacted]', 'Authorization=[redacted]', 'Bearer [redacted]', 'ordinary note'],
        requests: [{ cookieHeader: '[redacted]' }],
    })
})
