import { expect, mock, test } from 'bun:test'

let policyDecision: Record<string, unknown> = { status: 'allowed' }
let evaluatedAction: Record<string, unknown> | null = null
let auditedAction: Record<string, unknown> | null = null
let policyCalls = 0
let auditCalls = 0

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async () => ({ valid: true, id: 'agent-user' }),
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

const browserTaskTool = (await import('../src/handlers/tools/browserTask.ts')).default

test('allowed browser tasks preserve their policy action and audit before fetching', async () => {
    resetPolicyMocks()
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return new Response('<title>Example</title><h1>Welcome</h1>', { status: 200 })
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runBrowserTask({ url: 'https://example.com/path' })

        expect(statusCode).toBe(200)
        expect(responseBody).toMatchObject({ ok: true, status: 200, title: 'Example' })
        expect(evaluatedAction).toEqual({
            action: 'browser_task',
            actorId: 'agent-user',
            method: 'GET',
            target: 'https://example.com/path',
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

test('blocked browser tasks preserve the policy response and skip the fetch', async () => {
    resetPolicyMocks()
    policyDecision = { status: 'blocked', reason: 'Target is blocked.' }
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return Response.json({})
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runBrowserTask({ url: 'https://example.com/path' })

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

test('checkpoint browser tasks preserve the policy response and skip the fetch', async () => {
    resetPolicyMocks()
    policyDecision = { status: 'checkpoint_required', reason: 'Approval is required.' }
    let fetchCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        fetchCalls += 1
        return Response.json({})
    }) as typeof fetch

    try {
        const { statusCode, responseBody } = await runBrowserTask({ url: 'https://example.com/path' })

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
    policyDecision = { status: 'allowed' }
    evaluatedAction = null
    auditedAction = null
    policyCalls = 0
    auditCalls = 0
}

async function runBrowserTask(body: Record<string, unknown>) {
    let statusCode: number | undefined
    let responseBody: unknown
    const reply = {
        header() { return this },
        status(code: number) {
            statusCode = code
            return this
        },
        send(value: unknown) {
            responseBody = value
            return value
        },
    }
    await browserTaskTool({ body } as never, reply as never)
    return { statusCode, responseBody }
}
