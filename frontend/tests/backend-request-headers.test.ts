// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
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
        await Promise.all([fetchNotes(), fetchAutomations(), fetchManagedCronJobs()])

        expect(requests.map(({ url }) => url).sort()).toEqual([
            '/api/backend/automations',
            '/api/backend/notes',
            '/api/backend/system/cron',
        ])
        for (const { init } of requests) {
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

        const automationRequest = requests.find(({ url }) => url.endsWith('/automations'))
        expect(automationRequest?.init?.cache).toBe('no-store')
        expect(new Headers(automationRequest?.init?.headers).get('Cache-Control')).toBe('no-cache')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
