import { expect, mock, test } from 'bun:test'

let authenticationCalls = 0
let policyCalls = 0
let auditCalls = 0

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async () => {
        authenticationCalls += 1
        return { valid: true, id: 'agent-user' }
    },
}))
mock.module('../src/utils/ai/actionPolicy.ts', () => ({
    evaluateAgentActionPolicy: async () => {
        policyCalls += 1
        return { status: 'allowed' }
    },
    auditAgentAction: async () => {
        auditCalls += 1
    },
}))

const httpRequestTool = (await import('../src/handlers/tools/httpRequest.ts')).default

test('malformed request URL returns 400 before policy, audit, or network access', async () => {
    authenticationCalls = 0
    policyCalls = 0
    auditCalls = 0
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return Response.json({})
    }) as typeof fetch

    try {
        let statusCode: number | undefined
        let responseBody: unknown
        const reply = {
            status(code: number) {
                statusCode = code
                return this
            },
            send(body: unknown) {
                responseBody = body
                return body
            },
        }

        await httpRequestTool({ body: { url: 'not a URL' } } as never, reply as never)

        expect(statusCode).toBe(400)
        expect(responseBody).toEqual({ error: 'Invalid url.' })
        expect(authenticationCalls).toBe(1)
        expect(policyCalls).toBe(0)
        expect(auditCalls).toBe(0)
        expect(fetchCalls).toBe(0)
    } finally {
        globalThis.fetch = originalFetch
    }
})
