import http, { type IncomingMessage, type ServerResponse } from 'node:http'

export type ImpersonationRequest = {
    target_id?: string
    reason?: string
    durationMinutes?: number
    scope?: string[]
    supportSessionId?: string
}

export type MockImpersonationApi = {
    apiBase: string
    requests: ImpersonationRequest[]
    reset: () => void
    failNext: () => void
    close: () => Promise<void>
}

export async function startMockImpersonationApi(): Promise<MockImpersonationApi> {
    const requests: ImpersonationRequest[] = []
    let rejectNextImpersonation = false
    const server = http.createServer(async (request, response) => {
        try {
            await handleRequest(request, response, requests, () => {
                if (!rejectNextImpersonation) return false
                rejectNextImpersonation = false
                return true
            })
        } catch (error) {
            sendJson(response, { error: error instanceof Error ? error.message : 'Mock API failed.' }, 500)
        }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Mock API did not bind to a TCP port.')

    return {
        apiBase: `http://127.0.0.1:${address.port}/api`,
        requests,
        reset() {
            requests.length = 0
            rejectNextImpersonation = false
        },
        failNext() {
            rejectNextImpersonation = true
        },
        close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
    }
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    requests: ImpersonationRequest[],
    shouldFail: () => boolean,
) {
    const pathName = new URL(request.url || '/', 'http://127.0.0.1').pathname
    if (request.method === 'GET' && pathName.startsWith('/api/auth/token/')) {
        sendJson(response, { name: 'Admin User' })
        return
    }
    if (request.method === 'GET' && pathName === '/api/users') {
        sendJson(response, [
            { id: 'admin-user', name: 'Admin User', avatar: '', active: true },
            { id: 'target-user', name: 'Target User', avatar: '', active: true },
        ])
        return
    }
    if (request.method === 'GET' && (pathName === '/api/articles' || pathName === '/api/thoughts')) {
        sendJson(response, [])
        return
    }
    if (request.method === 'POST' && pathName === '/api/impersonation/start') {
        const body = await readJson<ImpersonationRequest>(request)
        requests.push(body)
        if (shouldFail()) {
            sendJson(response, { error: 'Mock backend refused impersonation for audit review.' }, 400)
            return
        }
        sendJson(response, {
            token: 'mock-impersonation-token',
            session: {
                id: 'mock-session',
                target: { id: body.target_id, name: 'Target User' },
                reason: body.reason,
                duration_minutes: body.durationMinutes,
                scope: body.scope,
                expires_at: '2026-07-03T01:00:00.000Z',
            },
        })
        return
    }
    sendJson(response, [])
}

function sendJson(response: ServerResponse, body: unknown, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(body))
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T
}
