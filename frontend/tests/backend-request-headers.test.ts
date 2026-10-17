// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import config from '../src/config'
import { backendRequestHeaders } from '../src/utils/auth/backendRequestHeaders'

test('notes, automations and system cron forward the shared backend auth headers', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    const requests: Array<{ url: string, init?: RequestInit }> = []

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=token%2Bvalue; id=user-123' },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({ url, init })
        const body = url.endsWith('/notes')
            ? []
            : url.endsWith('/automations')
                ? { automations: [] }
                : { jobs: [] }
        return Response.json(body)
    }) as typeof fetch

    try {
        const [{ fetchNotes }, { fetchAutomations }, { fetchManagedCronJobs }] = await Promise.all([
            import('../src/utils/notes/client'),
            import('../src/utils/automations/client'),
            import('../src/utils/systemCron/client'),
        ])
        const { backendJsonRequest } = await import('../src/utils/auth/backendJsonRequest')
        await Promise.all([fetchNotes(), fetchAutomations(), fetchManagedCronJobs()])
        await backendJsonRequest('/override', {
            errorMessage: 'Override request failed.',
            headers: { Authorization: 'Bearer delegated-token', 'X-Request-Mode': 'support' },
        })

        expect(requests.map(({ url }) => url).sort()).toEqual([
            '/api/backend/automations',
            '/api/backend/notes',
            '/api/backend/override',
            '/api/backend/system/cron',
        ])
        for (const { init } of requests.filter(({ url }) => !url.endsWith('/override'))) {
            const headers = new Headers(init?.headers)
            expect(headers.get('Content-Type')).toBe('application/json')
            expect(headers.get('Authorization')).toBe('Bearer token+value')
            expect(headers.get('id')).toBe('user-123')
        }
        const overriddenHeaders = new Headers(backendRequestHeaders({
            Authorization: 'Bearer delegated-token',
            'X-Request-Mode': 'support',
        }))
        expect(overriddenHeaders.get('Authorization')).toBe('Bearer delegated-token')
        expect(overriddenHeaders.get('X-Request-Mode')).toBe('support')
        const overrideRequest = requests.find(({ url }) => url.endsWith('/override'))
        expect(new Headers(overrideRequest?.init?.headers).get('Authorization')).toBe('Bearer delegated-token')
        expect(new Headers(overrideRequest?.init?.headers).get('X-Request-Mode')).toBe('support')

        const automationRequest = requests.find(({ url }) => url.endsWith('/automations'))
        expect(automationRequest?.init?.cache).toBe('no-store')
        expect(new Headers(automationRequest?.init?.headers).get('Cache-Control')).toBe('no-cache')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})

test('service-account requests use the shared auth headers and keep request options', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    const requests: Array<{ url: string, init?: RequestInit }> = []
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=service-token; id=service-user' },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json({ accounts: [], endpoints: [] })
    }) as typeof fetch

    try {
        const { requestServiceAccounts } = await import('../src/components/users/serviceAccounts')
        await requestServiceAccounts('/fixture', {
            method: 'POST',
            body: '{"name":"fixture"}',
            headers: { 'X-Ignored-By-Existing-Wrapper': 'value' },
        })

        const request = requests[0]
        const headers = new Headers(request.init?.headers)
        expect(request.url).toBe(`${config.url.api}/service-accounts/fixture`)
        expect(request.init?.method).toBe('POST')
        expect(request.init?.body).toBe('{"name":"fixture"}')
        expect(request.init?.cache).toBe('no-store')
        expect(headers.get('Content-Type')).toBe('application/json')
        expect(headers.get('Authorization')).toBe('Bearer service-token')
        expect(headers.get('id')).toBe('service-user')
        expect(headers.has('X-Ignored-By-Existing-Wrapper')).toBe(false)

        Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } })
        await requestServiceAccounts()
        const anonymousHeaders = new Headers(requests[1].init?.headers)
        expect(anonymousHeaders.get('Authorization')).toBe('Bearer')
        expect(anonymousHeaders.get('id')).toBe('')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})

test('backend JSON clients preserve refresh, cache, and bare apt headers', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    let cookieValue = 'access_token=initial; id=user-9'
    const cookieWrites: string[] = []
    const requests: Array<{ url: string, init?: RequestInit }> = []
    const documentStub = Object.defineProperty({}, 'cookie', {
        get: () => cookieValue,
        set: (value: string) => { cookieWrites.push(value); cookieValue = value },
        configurable: true,
    })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push({ url, init })
        const token = url.endsWith('/automations') ? 'automation-token' : url.endsWith('/system/cron') ? 'cron-token' : 'apt-token'
        return Response.json(url.endsWith('/system/updates?host=ovhcloud') ? { status: {}, history: [] } : {}, {
            headers: { 'x-access-token': token, 'x-access-token-expires-at': '2026-10-20T12:00:00Z' },
        })
    }) as typeof fetch

    try {
        const [{ fetchNotes }, { fetchAutomations }, { fetchManagedCronJobs }, { fetchAptUpdates }] = await Promise.all([
            import('../src/utils/notes/client'),
            import('../src/utils/automations/client'),
            import('../src/utils/systemCron/client'),
            import('../src/utils/aptUpdates/client'),
        ])
        const signal = new AbortController().signal
        await fetchNotes()
        expect(cookieWrites).toEqual([])

        await fetchAutomations()
        expect(cookieWrites[0]).toContain('access_token=automation-token')
        expect(cookieWrites[0]).toContain('expires=Tue, 20 Oct 2026 12:00:00 GMT')

        cookieValue = 'access_token=initial; id=user-9'
        await fetchManagedCronJobs()
        expect(cookieWrites[1]).toContain('access_token=cron-token')

        cookieValue = 'access_token=initial; id=user-9'
        await fetchAptUpdates('ovhcloud', signal)
        const automation = requests.find(request => request.url.endsWith('/automations'))!
        expect(automation.init?.cache).toBe('no-store')
        expect(new Headers(automation.init?.headers).get('Cache-Control')).toBe('no-cache')
        const apt = requests.find(request => request.url.endsWith('/system/updates?host=ovhcloud'))!
        expect(apt.init?.signal).toBe(signal)
        expect(apt.init?.cache).toBe('no-store')
        expect(apt.init?.headers).toEqual({ Authorization: 'Bearer initial', id: 'user-9' })
        expect(new Headers(apt.init?.headers).has('Content-Type')).toBe(false)
        expect(cookieWrites).toHaveLength(2)
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})

test('backend JSON transport keeps client-specific fallback errors for invalid JSON', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '' } })
    globalThis.fetch = (async () => new Response('not json', { status: 502 })) as typeof fetch
    try {
        const { fetchNotes } = await import('../src/utils/notes/client')
        await expect(fetchNotes()).rejects.toThrow('Notes request failed.')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
