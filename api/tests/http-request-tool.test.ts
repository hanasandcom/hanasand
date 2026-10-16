import { expect, mock, test } from 'bun:test'

let authenticationCalls = 0
let policyCalls = 0
let auditCalls = 0
let policyDecision: Record<string, unknown> = { status: 'allowed' }
let evaluatedAction: Record<string, unknown> | null = null
let auditedAction: Record<string, unknown> | null = null

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async () => {
        authenticationCalls += 1
        return { valid: true, id: 'agent-user' }
    },
}))
mock.module('../src/utils/ai/actionPolicy.ts', () => ({
    evaluateAgentActionPolicy: async (action: Record<string, unknown>) => {
        policyCalls += 1
        evaluatedAction = action
        return policyDecision
    },
    auditAgentAction: async (_req: unknown, action: Record<string, unknown>) => {
        auditCalls += 1
        auditedAction = action
    },
}))

const httpRequestTool = (await import('../src/handlers/tools/httpRequest.ts')).default

test('malformed request URL returns 400 before policy, audit, or network access', async () => {
    resetPolicyMocks()
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

test('allowed HTTP actions are evaluated, audited once, and then fetched', async () => {
    resetPolicyMocks()
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return new Response('ok', { status: 202 })
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runRequest({
            method: 'POST',
            url: 'https://example.com/path',
            body: 'payload',
            approved: true,
            approvalId: 'approval-1',
        })

        expect(statusCode).toBeUndefined()
        expect(responseBody).toMatchObject({ status: 202, body: 'ok' })
        expect(evaluatedAction).toEqual({
            action: 'http_request',
            actorId: 'agent-user',
            method: 'POST',
            target: 'https://example.com/path',
            content: 'payload',
            approved: true,
            approvalId: 'approval-1',
            metadata: { host: 'example.com' },
        })
        expect(auditedAction).toEqual(evaluatedAction)
        expect(policyCalls).toBe(1)
        expect(auditCalls).toBe(1)
        expect(fetchCalls).toBe(1)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('blocked HTTP actions preserve the policy response and skip the network request', async () => {
    resetPolicyMocks()
    policyDecision = { status: 'blocked', reason: 'Remote deletion is blocked.' }
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return Response.json({})
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runRequest({ method: 'DELETE', url: 'https://example.com/item' })

        expect(statusCode).toBe(403)
        expect(responseBody).toEqual({ error: policyDecision.reason, decision: policyDecision })
        expect(auditedAction).toEqual(evaluatedAction)
        expect(policyCalls).toBe(1)
        expect(auditCalls).toBe(1)
        expect(fetchCalls).toBe(0)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('checkpoint-required HTTP actions preserve the policy response and skip the network request', async () => {
    resetPolicyMocks()
    policyDecision = { status: 'checkpoint_required', reason: 'Approval is required.' }
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return Response.json({})
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runRequest({ method: 'POST', url: 'https://example.com/item' })

        expect(statusCode).toBe(409)
        expect(responseBody).toEqual({ error: policyDecision.reason, decision: policyDecision })
        expect(auditedAction).toEqual(evaluatedAction)
        expect(policyCalls).toBe(1)
        expect(auditCalls).toBe(1)
        expect(fetchCalls).toBe(0)
    } finally {
        globalThis.fetch = originalFetch
    }
})

function resetPolicyMocks() {
    authenticationCalls = 0
    policyCalls = 0
    auditCalls = 0
    policyDecision = { status: 'allowed' }
    evaluatedAction = null
    auditedAction = null
}

async function runRequest(body: Record<string, unknown>) {
    let statusCode: number | undefined
    let responseBody: unknown
    const reply = {
        status(code: number) {
            statusCode = code
            return this
        },
        send(value: unknown) {
            responseBody = value
            return value
        },
    }
    await httpRequestTool({ body } as never, reply as never)
    return { statusCode, responseBody }
}
