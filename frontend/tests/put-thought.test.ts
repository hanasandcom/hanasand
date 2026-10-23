// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'

test('updates thought title through authenticated same-origin backend proxy', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    const requests: Array<{ url: string, init?: RequestInit }> = []
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=token%2Bvalue; id=user-123' },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return Response.json({ message: 'Updated thought question/a.' }, { status: 201 })
    }) as typeof fetch

    try {
        const putThought = (await import('../src/utils/thoughts/putThought')).default
        const result = await putThought('question/a', 'A revised thought')
        const request = requests[0]
        const headers = new Headers(request.init?.headers)

        expect(result).toEqual({ message: 'Updated thought question/a.' })
        expect(request.url).toBe('/api/backend/thought/question%2Fa')
        expect(request.init?.method).toBe('PUT')
        expect(request.init?.body).toBe(JSON.stringify({ title: 'A revised thought' }))
        expect(headers.get('Content-Type')).toBe('application/json')
        expect(headers.get('Authorization')).toBe('Bearer token+value')
        expect(headers.get('id')).toBe('user-123')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})

test('reports backend thought update errors', async () => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const previousFetch = globalThis.fetch
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: { cookie: 'access_token=token; id=user-123' },
    })
    globalThis.fetch = (async () => Response.json({ error: 'Thought already exists' }, { status: 409 })) as typeof fetch

    try {
        const putThought = (await import('../src/utils/thoughts/putThought')).default
        await expect(putThought('thought-1', 'duplicate')).rejects.toThrow('Thought already exists')
    } finally {
        globalThis.fetch = previousFetch
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
        else Reflect.deleteProperty(globalThis, 'document')
    }
})
