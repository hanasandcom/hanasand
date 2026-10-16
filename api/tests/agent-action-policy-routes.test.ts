import { expect, mock, test } from 'bun:test'

let policyDecision: Record<string, unknown>
let evaluatedAction: Record<string, unknown> | null
let auditedAction: Record<string, unknown> | null
let auditedDecision: Record<string, unknown> | null
let calls: string[]

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async () => {
        calls.push('auth')
        return { valid: true, id: 'agent-user' }
    },
}))
mock.module('../src/utils/ai/actionPolicy.ts', () => ({
    evaluateAgentActionPolicy: async (action: Record<string, unknown>) => {
        calls.push('policy')
        evaluatedAction = action
        return policyDecision
    },
    auditAgentAction: async (_req: unknown, action: Record<string, unknown>, decision: Record<string, unknown>) => {
        calls.push('audit')
        auditedAction = action
        auditedDecision = decision
    },
}))

const httpRequestTool = (await import('../src/handlers/tools/httpRequest.ts')).default
const browserTaskTool = (await import('../src/handlers/tools/browserTask.ts')).default

const requestBodies = {
    http: {
        allowed: { method: 'POST', url: 'https://example.com/path', body: 'payload', approved: true, approvalId: 'approval-1' },
        blocked: { method: 'DELETE', url: 'https://example.com/item' },
        checkpoint_required: { method: 'POST', url: 'https://example.com/item' },
    },
    browser: { url: 'https://example.com/path' },
}

const decisions = {
    allowed: { status: 'allowed', risk: 'low', reason: 'Allowed.', hardBlock: false, safeAlternative: 'Proceed.' },
    blocked: { status: 'blocked', risk: 'critical', reason: 'Target is blocked.', hardBlock: true, safeAlternative: 'Use a safe target.' },
    checkpoint_required: { status: 'checkpoint_required', risk: 'high', reason: 'Approval is required.', hardBlock: false, safeAlternative: 'Request approval.', requiredApproval: 'explicit_user_checkpoint' },
}

for (const tool of ['http', 'browser'] as const) {
    for (const status of ['allowed', 'blocked', 'checkpoint_required'] as const) {
        const body = tool === 'http' ? requestBodies.http[status] : requestBodies.browser
        const decision = decisions[status]
        test(`${tool} action ${status} is audited before the correct network outcome`, async () => {
            resetMocks(decision)
            const { statusCode, responseBody } = await runTool(tool, body)

            expect(evaluatedAction).toEqual(expectedAction(tool, body))
            expect(auditedAction).toEqual(evaluatedAction)
            expect(auditedDecision).toEqual(decision)
            expect(calls).toEqual(status === 'allowed' ? ['auth', 'policy', 'audit', 'fetch'] : ['auth', 'policy', 'audit'])
            if (status === 'allowed') {
                expect(responseBody).toMatchObject(tool === 'http' ? { status: 202, body: 'ok' } : { ok: true, status: 200, title: 'Example' })
                if (tool === 'browser') expect(statusCode).toBe(200)
                else expect(statusCode).toBeUndefined()
            } else {
                expect(statusCode).toBe(status === 'blocked' ? 403 : 409)
                expect(responseBody).toEqual({ error: decision.reason, decision })
            }
        })
    }
}

test('malformed HTTP URL returns 400 after auth and before policy, audit, or fetch', async () => {
    resetMocks(decisions.allowed)
    const { statusCode, responseBody } = await runTool('http', { url: 'not a URL' })

    expect(statusCode).toBe(400)
    expect(responseBody).toEqual({ error: 'Invalid url.' })
    expect(calls).toEqual(['auth'])
})

function resetMocks(decision: Record<string, unknown>) {
    policyDecision = decision
    evaluatedAction = null
    auditedAction = null
    auditedDecision = null
    calls = []
}

function expectedAction(tool: 'http' | 'browser', body: Record<string, unknown>) {
    const target = new URL(String(body.url))
    const action: Record<string, unknown> = {
        action: tool === 'http' ? 'http_request' : 'browser_task',
        actorId: 'agent-user',
        method: tool === 'http' ? body.method : 'GET',
        target: target.toString(),
        metadata: { host: target.hostname },
    }
    if (tool === 'http') {
        action.content = body.body
        action.approved = body.approved === true
        action.approvalId = typeof body.approvalId === 'string' ? body.approvalId : null
    }
    return action
}

async function runTool(tool: 'http' | 'browser', body: Record<string, unknown>) {
    let statusCode: number | undefined
    let responseBody: unknown
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
        calls.push('fetch')
        return tool === 'http'
            ? new Response('ok', { status: 202 })
            : new Response('<title>Example</title><h1>Welcome</h1>', { status: 200 })
    }) as typeof fetch
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

    try {
        const handler = tool === 'http' ? httpRequestTool : browserTaskTool
        await handler({ body } as never, reply as never)
        return { statusCode, responseBody }
    } finally {
        globalThis.fetch = originalFetch
    }
}
