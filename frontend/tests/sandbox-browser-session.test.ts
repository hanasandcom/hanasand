// @ts-expect-error Bun provides this module when running tests.
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { ensureBrowserIdentitySession } from '../src/app/sandbox/_browser/browser/browserSession'
import { browserApiBaseForOrigin, browserBrokerBaseForOrigin } from '../src/app/sandbox/_browser/browser/browserSetup'

const originalFetch = globalThis.fetch
const originalDocument = globalThis.document

beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'id=current-user; access_token=current-identity-token' },
    })
})

afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
})

test('uses the current Identity session to establish and verify the Browser API session', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    let sessionReady = false
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        if (String(input).includes('/auth/token/current-user')) {
            return Response.json({ id: 'current-user', name: 'Ada', token: 'current-identity-token' })
        }
        if (init?.method === 'POST') {
            sessionReady = true
            return Response.json({ ok: true, user: { id: 'current-user' } })
        }
        if (sessionReady) return Response.json({ user: { id: 'current-user' }, canSignOut: true })
        return Response.json({ user: null })
    }) as typeof fetch

    const session = await ensureBrowserIdentitySession()

    expect(session.user?.id).toBe('current-user')
    expect(requests).toHaveLength(4)
    expect(requests[0]?.url).toEndWith('/auth/token/current-user')
    expect(requests[1]?.url).toEndWith('/browser/session')
    expect(requests[2]?.init?.method).toBe('POST')
    expect(requests[2]?.init?.credentials).toBe('include')
    expect(requests[2]?.init?.body).toBe(JSON.stringify({ id: 'current-user', token: 'current-identity-token' }))
    expect(requests[3]?.init?.method).toBeUndefined()
})

test('replaces a stale Browser session with the verified current Identity user', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    let sessionReady = false
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        if (String(input).includes('/auth/token/current-user')) {
            return Response.json({ id: 'current-user', token: 'current-identity-token' })
        }
        if (init?.method === 'POST') {
            sessionReady = true
            return Response.json({ ok: true })
        }
        if (sessionReady) return Response.json({ user: { id: 'current-user' }, canSignOut: true })
        return Response.json({ user: { id: 'old-user' }, canSignOut: true })
    }) as typeof fetch

    const session = await ensureBrowserIdentitySession()

    expect(session.user?.id).toBe('current-user')
    expect(requests).toHaveLength(4)
    expect(requests[2]?.init?.method).toBe('POST')
})

test('does not treat partial Identity cookies as a guest session', async () => {
    for (const cookie of ['id=current-user', 'access_token=current-identity-token']) {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie } })
        globalThis.fetch = (async () => Response.json({ user: null })) as typeof fetch

        await expect(ensureBrowserIdentitySession()).rejects.toThrow('Your Hanasand session is incomplete.')
    }
})

test('trusts a Browser API session that already verified partially visible Identity cookies', async () => {
    for (const cookie of ['id=current-user', 'access_token=current-identity-token']) {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie } })
        let requests = 0
        globalThis.fetch = (async () => {
            requests += 1
            return Response.json({ user: { id: 'current-user' }, canSignOut: false })
        }) as typeof fetch

        const session = await ensureBrowserIdentitySession()

        expect(session.user?.id).toBe('current-user')
        expect(requests).toBe(1)
    }
})

test('keeps the anonymous session available when no Identity cookies are present', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } })
    globalThis.fetch = (async () => Response.json({ user: null })) as typeof fetch

    expect(await ensureBrowserIdentitySession()).toEqual({ user: null })
})

test('routes the standard Hanasand sandbox API and broker through the signed-in site origin', () => {
    const api = browserApiBaseForOrigin('https://hanasand.com', 'https://browsers.hanasand.com/api')
    const broker = browserBrokerBaseForOrigin('https://hanasand.com', api, 'wss://browsers.hanasand.com/api/ws/browser')

    expect(api).toBe('https://hanasand.com/api')
    expect(broker).toBe('wss://hanasand.com/api/ws/browser')
})
