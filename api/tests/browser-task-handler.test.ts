import { afterEach, expect, mock, test } from 'bun:test'

let policyCalls = 0
let authenticated = true

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: async () => ({ valid: authenticated, id: authenticated ? 'browser-task-test' : undefined }),
}))
mock.module('../src/handlers/tools/agentActionPolicy.ts', () => ({
    applyAgentActionPolicy: async () => {
        policyCalls += 1
        return null
    },
}))

const browserTaskTool = (await import('../src/handlers/tools/browserTask.ts')).default

afterEach(() => {
    authenticated = true
    policyCalls = 0
})

for (const [url, error] of [
    [undefined, 'Missing url.'],
    ['not a URL', 'Invalid url.'],
    ['file:///tmp/page.html', 'Only http and https browser tasks are supported.'],
] as const) {
    test(`browser task rejects ${url ?? 'a missing URL'} before policy evaluation`, async () => {
        policyCalls = 0
        const { statusCode, body } = await runTool({ url })

        expect(statusCode).toBe(400)
        expect(body).toEqual({ error })
        expect(policyCalls).toBe(0)
    })
}

test('browser task rejects an unauthenticated actor before policy evaluation', async () => {
    authenticated = false
    const { statusCode, body } = await runTool({ url: 'https://example.com/' })

    expect(statusCode).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized.' })
    expect(policyCalls).toBe(0)
})

async function runTool(body: Record<string, unknown>) {
    let statusCode: number | undefined
    let responseBody: unknown
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

    await browserTaskTool({ body } as never, reply as never)
    return { statusCode, body: responseBody }
}
