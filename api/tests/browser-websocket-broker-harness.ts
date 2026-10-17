import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import WebSocket from 'ws'
import { afterEach, mock } from 'bun:test'

const originalEnvironment = new Map([
    'BROWSER_SANDBOX_WORKER_ONLY', 'BROWSER_SANDBOX_ALLOW_SHARED_WORKER',
    'BROWSER_SANDBOX_WORKER_WS', 'BROWSER_SANDBOX_MAX_SESSIONS', 'NODE_ENV',
].map(key => [key, process.env[key]]))

export const state: {
    releaseDelayedAuthorization: ((result: { allowed: false; quota: null; reason: string }) => void) | null
    delayedAuthorizationStarted: boolean
} = { releaseDelayedAuthorization: null, delayedAuthorizationStarted: false }

mock.module('../src/handlers/browserSandboxRuns.ts', () => ({
    browserPaidExtensionAllowed: async () => false,
    finishBrowserRun: async () => undefined,
    persistBrowserRunEvidence: async () => undefined,
    prepareBrowserRun: async (input: { clientId?: string }) => {
        if (input.clientId === 'delayed-auth-client') {
            state.delayedAuthorizationStarted = true
            return await new Promise<{ allowed: false; quota: null; reason: string }>(resolve => {
                state.releaseDelayedAuthorization = resolve
            })
        }
        return { allowed: false as const, quota: null, reason: 'identity_required' }
    },
    refreshBrowserRunLease: async () => undefined,
    updateBrowserRunProviderResult: async () => undefined,
}))

afterEach(() => {
    for (const [key, value] of originalEnvironment) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }
    state.releaseDelayedAuthorization = null
    state.delayedAuthorizationStarted = false
})

export async function startBrokerClient(path: string) {
    const app = Fastify()
    await app.register(websocket)
    const { default: wsPlugin } = await import('../src/plugins/ws.ts')
    await app.register(wsPlugin)
    await app.ready()
    const address = await app.listen({ host: '127.0.0.1', port: 0 })
    const client = new WebSocket(address.replace('http', 'ws') + path)
    await new Promise<void>((resolve, reject) => {
        client.once('open', resolve)
        client.once('error', reject)
    })
    return { app, client }
}

export async function closeBrokerClient(app: Awaited<ReturnType<typeof Fastify>>, client: WebSocket) {
    client.terminate()
    for (const connection of [...app.websocketServer.clients]) connection.terminate()
    app.server.closeAllConnections()
    await app.close()
}
