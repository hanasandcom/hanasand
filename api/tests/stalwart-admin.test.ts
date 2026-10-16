import { afterAll, afterEach, expect, test } from 'bun:test'

const previousFetch = globalThis.fetch
const previousEnvironment = {
    MAIL_ADMIN_PASSWORD: process.env.MAIL_ADMIN_PASSWORD,
    MAIL_ADMIN_USERNAME: process.env.MAIL_ADMIN_USERNAME,
    MAIL_ADMIN_TIMEOUT_MS: process.env.MAIL_ADMIN_TIMEOUT_MS,
    MAIL_DOMAIN: process.env.MAIL_DOMAIN,
    MAIL_INTERNAL_URL: process.env.MAIL_INTERNAL_URL,
}

process.env.MAIL_ADMIN_PASSWORD = 'test-admin-password'
process.env.MAIL_ADMIN_USERNAME = 'test-admin'
process.env.MAIL_ADMIN_TIMEOUT_MS = '30'
process.env.MAIL_DOMAIN = 'example.test'
process.env.MAIL_INTERNAL_URL = 'http://mail.test:8081/'

const { fetchRecommendedDns, findPrincipalByName } = await import('../src/utils/mail/stalwartAdmin.ts')

afterEach(() => {
    globalThis.fetch = previousFetch
})

afterAll(() => {
    restoreEnvironment('MAIL_ADMIN_PASSWORD', previousEnvironment.MAIL_ADMIN_PASSWORD)
    restoreEnvironment('MAIL_ADMIN_USERNAME', previousEnvironment.MAIL_ADMIN_USERNAME)
    restoreEnvironment('MAIL_ADMIN_TIMEOUT_MS', previousEnvironment.MAIL_ADMIN_TIMEOUT_MS)
    restoreEnvironment('MAIL_DOMAIN', previousEnvironment.MAIL_DOMAIN)
    restoreEnvironment('MAIL_INTERNAL_URL', previousEnvironment.MAIL_INTERNAL_URL)
})

test('admin requests abort after the configured timeout', async () => {
    let requestSignal: AbortSignal | undefined
    globalThis.fetch = (async (_input, init) => new Promise<Response>((_resolve, reject) => {
        requestSignal = init?.signal as AbortSignal
        requestSignal.addEventListener('abort', () => reject(requestSignal?.reason), { once: true })
    })) as typeof fetch

    let requestError: unknown
    try {
        await fetchRecommendedDns('example.test')
    } catch (error) {
        requestError = error
    }

    expect(requestSignal).toBeInstanceOf(AbortSignal)
    expect(requestSignal?.aborted).toBe(true)
    expect((requestError as DOMException).name).toBe('TimeoutError')
})

test('a missing principal route falls back to JMAP and the session API path stays internal', async () => {
    const requests: Array<{ url: URL, init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
        const url = new URL(String(input))
        requests.push({ url, init })

        if (url.pathname === '/api/principal/ada') {
            return new Response('route not found', { status: 404 })
        }
        if (url.pathname === '/jmap/session') {
            return Response.json({ apiUrl: 'https://provider.example/custom/jmap' })
        }
        if (url.pathname === '/custom/jmap') {
            return new Response('route not found', { status: 404 })
        }
        if (url.pathname !== '/api') {
            return new Response('unexpected endpoint', { status: 500 })
        }

        const payload = JSON.parse(String(init?.body)) as { methodCalls: Array<[string]> }
        if (payload.methodCalls[0][0] === 'x:Account/query') {
            return Response.json({ methodResponses: [['x:Account/query', { ids: ['account-42'] }, 'admin']] })
        }
        return Response.json({ methodResponses: [['x:Account/get', { list: [{
            id: 'account-42',
            '@type': 'User',
            name: 'ada',
            emailAddress: 'ada@example.test',
            aliases: { '0': { name: 'alias' } },
            credentials: { '0': { '@type': 'Password', secret: 'mail-secret' } },
            roles: { '@type': 'User' },
            domainId: 'domain-1',
        }] }, 'admin']] })
    }) as typeof fetch

    await expect(findPrincipalByName('ada', 'individual')).resolves.toMatchObject({
        id: 'account-42',
        name: 'ada',
        type: 'individual',
        emails: ['ada@example.test', 'alias@example.test'],
        secrets: ['mail-secret'],
        roles: ['user'],
        domainId: 'domain-1',
    })

    expect(requests[0].url.pathname).toBe('/api/principal/ada')
    expect(requests.filter(request => request.url.pathname === '/jmap/session')).toHaveLength(2)
    expect(requests.filter(request => request.url.pathname === '/custom/jmap')).toHaveLength(2)
    expect(requests.filter(request => request.url.pathname === '/api').map(request => new URL(request.url).host)).toEqual(['mail.test:8081', 'mail.test:8081'])
    expect(requests.filter(request => request.url.pathname === '/custom/jmap').every(request => request.url.host === 'mail.test:8081')).toBe(true)
})

function restoreEnvironment(name: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[name]
    } else {
        process.env[name] = value
    }
}
