import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let connected = true
let blocked = false
let request: any
const evaluatedActions: Array<Record<string, any>> = []
const auditedActions: Array<Record<string, any>> = []
const usageEvents: Array<Record<string, any>> = []
mock.module('../src/utils/ws/handleGptMessage.ts', () => ({
    listGptClients: () => connected ? [{ name: 'test', model: { status: 'idle' } }] : [],
    requestGptCompletion: async (_type: string, input: any) => { request = input; return { content: '{"facts":[]}' } },
}))
mock.module('../src/utils/ai/actionPolicy.ts', () => ({
    evaluateAgentActionPolicy: async (input: Record<string, any>) => {
        evaluatedActions.push(input)
        return { status: blocked ? 'blocked' : 'allowed', reason: 'policy', safeAlternative: 'safe input' }
    },
    auditAgentAction: async (_request: unknown, input: Record<string, any>) => { auditedActions.push(input) },
    redactAgentText: (text: string) => text,
}))
mock.module('../src/utils/ai/usage.ts', () => ({ recordAiUsageEvent: async (event: Record<string, any>) => { usageEvents.push(event) } }))
const { default: ai } = await import('../src/handlers/tools/ai.ts')
test('explicit completions use model output, retain policy checks and never substitute a scaffold when unavailable', async () => {
    const app = Fastify()
    app.post('/ai', ai)
    const payload = { action: 'complete', prompt: 'Extract JSON facts from this source: build a website with Dockerfile and dependencies.' }
    try {
        const result = (await app.inject({ method: 'POST', url: '/ai', payload })).json()
        expect(result.model).toBe('test')
        expect(result.message).toBe('{"facts":[]}')
        expect(request.messages[0].content).toContain('output format exactly')
        expect(request.messages[1].content).toBe(payload.prompt)
        for (const prompt of ['Explain this threat report about a Dockerfile and website.', 'Help me plan my day.', 'Build a small website.']) {
            const general = (await app.inject({ method: 'POST', url: '/ai', payload: { prompt } })).json()
            expect(general.model).toBe('test')
            expect(request.messages[0].content).toContain('general questions, threat intelligence, and coding')
            expect(request.messages[0].content).not.toContain('include complete runnable files')
        }
        expect((await app.inject({ method: 'POST', url: '/ai', payload: { action: 'scaffold', prompt: 'Build a website with a Dockerfile' } })).json().model).toBe('share-builder')
        usageEvents.length = 0
        const scaffoldPayload = { action: 'scaffold', prompt: 'Build a website with a Dockerfile for the Norwegian library catalogue' }
        const scaffoldHeaders = { id: 'scaffold-accounting-user' }
        const first = (await app.inject({ method: 'POST', url: '/ai', headers: scaffoldHeaders, payload: scaffoldPayload })).json()
        const second = (await app.inject({ method: 'POST', url: '/ai', headers: scaffoldHeaders, payload: scaffoldPayload })).json()
        expect(first.message).toBe(second.message)
        expect(first.cache.hit).toBe(false)
        expect(second.cache.hit).toBe(true)
        expect(usageEvents.map(event => event.kind)).toEqual(['ai_run_completed', 'cache_hit', 'ai_run_completed'])
        expect(usageEvents[0].metadata).toMatchObject({ model: 'share-builder', cacheHit: false })
        expect(usageEvents[2].metadata).toMatchObject({ model: 'share-builder', cacheHit: true })
        expect(usageEvents[2].metadata.toolCalls).toBe(usageEvents[0].metadata.toolCalls)
        connected = false
        expect((await app.inject({ method: 'POST', url: '/ai', payload })).json().status).toBe('connecting')
        expect((await app.inject({ method: 'POST', url: '/ai', payload: { prompt: payload.prompt } })).json().status).toBe('connecting')
        const disconnectedScaffold = (await app.inject({
            method: 'POST',
            url: '/ai',
            payload: { action: 'scaffold', prompt: 'Build a small website with a Dockerfile.' },
        })).json()
        expect(disconnectedScaffold).toMatchObject({ status: 'completed', model: 'share-builder' })
        expect(disconnectedScaffold.message).toContain('<hanasand-tool>')
        blocked = true
        expect((await app.inject({ method: 'POST', url: '/ai', payload })).statusCode).toBe(403)

        const actionPayload = { action: 'audit_agent_action', path: 'src/app.ts', content: 'safe change' }
        expect((await app.inject({ method: 'POST', url: '/ai', payload: actionPayload })).statusCode).toBe(403)
        expect(auditedActions.at(-1)).toEqual(evaluatedActions.at(-1))
    } finally { await app.close() }
})

test('HTTP replicas forward inference and identity to the model worker and preserve failures', async () => {
    const original = process.env.AI_HEALTH_WORKER_BASE
    let status = 200
    let calls = 0
    const worker = Bun.serve({ port: 0, async fetch(request) {
        calls++
        expect(new URL(request.url).pathname).toBe('/api/tools/ai')
        expect(request.headers.get('authorization')).toBe('Bearer test-token')
        expect(request.headers.get('id')).toBe('test-user')
        expect(request.headers.get('x-ai-tool-forwarded')).toBe('1')
        expect(await request.json()).toEqual({ prompt: 'Explain TLS.' })
        return Response.json({ message: 'model response' }, { status })
    } })
    process.env.AI_HEALTH_WORKER_BASE = worker.url.toString()
    const app = Fastify()
    app.post('/ai', ai)
    const input = { method: 'POST' as const, url: '/ai', headers: { authorization: 'Bearer test-token', id: 'test-user' }, payload: { prompt: 'Explain TLS.' } }
    try {
        expect((await app.inject(input)).json().message).toBe('model response')
        status = 403
        expect((await app.inject(input)).statusCode).toBe(403)
        expect((await app.inject({ ...input, headers: { ...input.headers, 'x-ai-tool-forwarded': '1' } })).statusCode).toBe(503)
        expect(calls).toBe(2)
        worker.stop(true)
        expect((await app.inject(input)).statusCode).toBe(503)
    } finally {
        worker.stop(true)
        if (original === undefined) delete process.env.AI_HEALTH_WORKER_BASE
        else process.env.AI_HEALTH_WORKER_BASE = original
        await app.close()
    }
})
