import { afterEach, expect, mock, test } from 'bun:test'

mock.module('#constants', () => ({ default: { vm_api_token: 'server-only-key' } }))

const { deviceProofFromRequest, hasTrustedServerSession } = await import('../src/utils/auth/deviceProofRequest.ts')

const request = (overrides: Record<string, string> = {}) => ({
    headers: {
        'x-hanasand-server-session-validated': '1',
        'x-hanasand-server-session-id': 'user-a',
        'x-hanasand-server-session-token': 'session-token-a',
        'x-hanasand-server-session-assertion': 'server-only-key',
        ...overrides,
    },
})

test('trusted server session requires the server secret and exact user session', () => {
    expect(hasTrustedServerSession(request() as never, 'user-a', 'session-token-a')).toBe(true)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-id': 'user-b' }) as never, 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-token': 'other-token' }) as never, 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-assertion': 'wrong-key' }) as never, 'user-a', 'session-token-a')).toBe(false)
    expect(hasTrustedServerSession(request({ 'x-hanasand-server-session-validated': '0' }) as never, 'user-a', 'session-token-a')).toBe(false)
})


const originalOrigin = process.env.NEXT_PUBLIC_API
afterEach(() => {
    if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_API
    else process.env.NEXT_PUBLIC_API = originalOrigin
})
const routes = [
    ['GET', '/api/organizations/:id/watchlists', '/api/organizations/org.name/watchlists'],
    ['POST', '/api/organizations/:id/watchlists', '/api/organizations/org%3Aname/watchlists'],
    ['POST', '/api/organizations/:id/watchlists/cleanup', '/api/organizations/org%40domain/watchlists/cleanup'],
    ['POST', '/api/organizations/:id/watchlists/reconcile', '/api/organizations/.org/watchlists/reconcile'],
    ['PUT', '/api/organizations/:organizationId/watchlists/:itemId', '/api/organizations/org/watchlists/cleanup'],
    ['POST', '/api/organizations/:organizationId/watchlists/:itemId/actions', '/api/organizations/org/watchlists/item%3Aname/actions'],
    ['DELETE', '/api/organizations/:organizationId/watchlists/:itemId', '/api/organizations/org/watchlists/reconcile'],
    ['GET', '/api/organizations/:organizationId/watchlists/:itemId', '/api/organizations/org%3Aname/watchlists/item%40domain'],
    ['GET', '/api/organizations/:id/watchlists/alert-terms', '/api/organizations/.org/watchlists/alert-terms'],
]
function proofRequest(method: string, route: string, path: string, headers: Record<string, string> = {}) {
    return { method, routeOptions: { url: route }, raw: { url: path }, url: '/rewritten/internal/path',
        protocol: 'http', headers: { dpop: 'synthetic-proof', host: 'private.internal', ...headers } } as never
}

test('all nine registered Watchlist pairs bind actual method and encoded raw path to the server origin', () => {
    delete process.env.NEXT_PUBLIC_API
    for (const [method, route, path] of routes) {
        const result = deviceProofFromRequest(proofRequest(method!, route!, path!+'?search=excluded', {
            'x-device-proof-method': 'GET', 'x-device-proof-url': 'https://foreign.invalid/api/unrelated',
            'x-forwarded-host': 'foreign.invalid', 'x-forwarded-proto': 'http',
        }))
        expect(result).toEqual({ proof: 'synthetic-proof', method, url: 'https://api.hanasand.com'+path })
    }
})
test('an unset or blank API origin uses the canonical production API origin', () => {
    const path = '/api/organizations/org/watchlists'
    for (const origin of [undefined, '', '   ']) {
        if (origin === undefined) delete process.env.NEXT_PUBLIC_API
        else process.env.NEXT_PUBLIC_API = origin
        expect(deviceProofFromRequest(proofRequest('GET', routes[0]![1]!, path))).toEqual({
            proof: 'synthetic-proof', method: 'GET', url: 'https://api.hanasand.com'+path,
        })
    }
})
test('normal native same-value headers remain compatible and are not required', () => {
    process.env.NEXT_PUBLIC_API = 'https://configured.example:8443/api/'
    const path = '/api/organizations/org/watchlists/reconcile'
    const nativeHeaders: Array<Record<string, string>> = [{}, { 'x-device-proof-method': 'POST', 'x-device-proof-url': 'https://configured.example:8443'+path }]
    for (const headers of nativeHeaders) {
        expect(deviceProofFromRequest(proofRequest('POST', routes[3]![1]!, path, headers))).toEqual({
            proof: 'synthetic-proof', method: 'POST', url: 'https://configured.example:8443'+path,
        })
    }
})
test('invalid configured Watchlist origins fail closed without legacy header fallback', () => {
    for (const origin of ['not-a-url', 'http://api.hanasand.com', 'ftp://api.hanasand.com',
        'https://user:secret@api.hanasand.com', 'https://api.hanasand.com/api?query=1', 'https://api.hanasand.com/#fragment', 'https://api.hanasand.com/api?', 'https://api.hanasand.com/#']) {
        process.env.NEXT_PUBLIC_API = origin
        expect(() => deviceProofFromRequest(proofRequest('POST', routes[3]![1]!, routes[3]![2]!, {
            'x-device-proof-url': 'https://api.hanasand.com'+routes[3]![2],
        }))).toThrow()
    }
})
test('malformed raw targets cannot change the configured origin', () => {
    delete process.env.NEXT_PUBLIC_API
    for (const path of ['//foreign.invalid/api/organizations/org/watchlists', 'https://foreign.invalid/path', '/api/organizations/org\\item/watchlists', '/api/organizations/org/watchlists#fragment', '/api/organizations/org/watchlists\n']) {
        expect(() => deviceProofFromRequest(proofRequest('POST', routes[1]![1]!, path))).toThrow()
    }
})
test('generic routes and nonselected method pairs retain their existing proof transport', () => {
    process.env.NEXT_PUBLIC_API = 'invalid configuration unused by legacy routes'
    for (const [method, route, path] of [['GET', '/api/profile', '/api/profile'],
        ['PATCH', '/api/organizations/:id/watchlists', '/api/organizations/org/watchlists'],
        ['GET', '/api/organizations/:id/api-keys', '/api/organizations/org/api-keys']]) {
        expect(deviceProofFromRequest(proofRequest(method!, route!, path!, {
            'x-device-proof-method': 'GET', 'x-device-proof-url': 'https://legacy.example/previous-target',
        }))).toEqual({ proof: 'synthetic-proof', method: 'GET', url: 'https://legacy.example/previous-target' })
    }
})

mock.module('#db', () => ({ isTransientDatabaseError: () => false }))
mock.module('../src/utils/auth/impersonationAuthorization.ts', () => ({
    auditImpersonatedRequest: async () => {}, loadImpersonationTarget: async () => null, impersonationTargetId: () => null,
}))
const tokenWrapper = (await import('../src/utils/auth/tokenWrapper.ts')).default
test('a verified server session cached by the limiter is reused without consuming another proof', async () => {
    const req = { ...request(), method: 'POST', url: routes[3]![2], headers: {
        ...request().headers, authorization: 'Bearer session-token-a', id: 'user-a',
    }, rateLimitSession: { user: { id: 'user-a' }, session: { token: 'session-token-a' },
        refreshed: { token: 'session-token-a', expires_at: '2030-01-01T00:00:00Z' } } }
    let validations = 0
    expect(hasTrustedServerSession(req as never, 'user-a', 'session-token-a')).toBe(true)
    const result = await tokenWrapper(req as never, { header() {} } as never, async () => { validations++; return null })
    expect(result.valid).toBe(true)
    expect(validations).toBe(0)
})
