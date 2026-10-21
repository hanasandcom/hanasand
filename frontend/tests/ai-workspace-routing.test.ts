// @ts-expect-error Bun provides this module when running tests.
import { expect, mock, test } from 'bun:test'

mock.module('@/config', () => ({ default: { url: { api: 'http://main-api.test/api', ai: 'http://ai-api.test/api' } } }))

const { getAiWorkspace } = await import('../src/utils/ai/getWorkspace')

test('AI workspace loads from the AI API instead of the main API', async () => {
    const previousFetch = globalThis.fetch
    let requestedUrl = ''
    let requestHeaders: Headers | null = null
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requestedUrl = String(input)
        requestHeaders = new Headers(init?.headers)
        return Response.json({ conversations: [] })
    }) as typeof fetch

    try {
        const workspace = await getAiWorkspace({ id: 'user-1', token: 'session-token' })
        expect(workspace.authStatus).toBe('ready')
        expect(requestedUrl).toBe('http://ai-api.test/api/ai/workspace')
        expect(requestHeaders?.get('authorization')).toBe('Bearer session-token')
        expect(requestHeaders?.get('id')).toBe('user-1')
    } finally {
        globalThis.fetch = previousFetch
    }
})
