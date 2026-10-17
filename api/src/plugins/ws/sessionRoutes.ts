import type { FastifyInstance, FastifyRequest } from 'fastify'
import WebSocket from 'ws'
import { resumableBrowserSocket } from '#utils/ws/browserReconnect.ts'
import { handleOnionSessionSocket, registerPrestartedBrowser } from '../../handlers/onionSession/ws.ts'
import { proxyBrowserSocket } from './browserProxy.ts'

export function registerBrowserSessionRoutes(fastify: FastifyInstance) {
    registerPrestartedBrowser(fastify)
    const routes = [
        { url: '/api/ws/browser/:id', name: 'browser', network: 'regular' },
        { url: '/api/ws/onion-session/:id', name: 'onion-session', network: 'tor' },
        { url: '/api/ws/browser-sandbox/:id', name: 'browser-sandbox', network: 'regular' },
    ] as const

    for (const route of routes) {
        fastify.get<{ Params: { id: string } }>(route.url, { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
            const { id } = req.params
            if (proxyBrowserSocket(connection, id, route.name)) return
            const worker = process.env.BROWSER_SANDBOX_WORKER_ONLY === '1' ? resumableBrowserSocket(connection, id) : connection
            if (worker) handleOnionSessionSocket(worker, id, route.network)
        })
    }
}

