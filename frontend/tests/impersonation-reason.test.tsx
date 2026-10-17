import { expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeImpersonationReason } from '../src/utils/impersonation/normalizeReason'
import ImpersonationReasonPrompt from '../src/components/users/impersonationReasonPrompt'

mock.module('@/utils/cookies/cookies', () => ({
    getCookie: (name: string) => name === 'id' ? 'operator-7' : 'token-7',
    removeCookies: () => {},
}))

const { startImpersonating } = await import('../src/utils/impersonation/client')

test('impersonation reason display and request share whitespace normalization', async () => {
    const reason = ' Support\t case\n123 '
    const normalized = normalizeImpersonationReason(reason)
    expect(normalized).toBe('Support case 123')
    expect(normalized.length).toBe(16)

    const prompt = renderToStaticMarkup(createElement(ImpersonationReasonPrompt, {
        userId: 'target-4', userName: 'Target', reason, reasonError: '', pending: false,
        onReasonChange: () => {}, onCancel: () => {}, onSubmit: () => {},
    }))
    expect(prompt).toContain('16/10')

    const originalFetch = globalThis.fetch
    const requests: Array<{ url: string, init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(JSON.stringify({ session: { target: { id: 'target-4' } } }), { status: 200 })
    }) as typeof fetch
    try {
        await startImpersonating('target-4', reason)
        expect(requests).toHaveLength(1)
        expect(requests[0].url).toBe('/api/impersonation/start')
        expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({ target_id: 'target-4', reason: normalized })
    } finally {
        globalThis.fetch = originalFetch
    }
})
