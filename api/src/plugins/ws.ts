import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import WebSocket from 'ws'
import registerSupportProxyStream from '../handlers/supportProxyStream.ts'
import registerSystemStream from '../handlers/metrics/systemStream.ts'
import registerVmConsole from '../handlers/vms/console.ts'
import registerInternalVmConsole from '../handlers/vms/consoleInternal.ts'
import registerHostConsole from '../handlers/hostConsole.ts'
import { subscribeThesis } from '#utils/thesis.ts'
import { thesisCredentials, thesisMember } from '#utils/thesisAccess.ts'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import { countGptViewers, gpt, handleGptMessage, sendGptSnapshot, unregisterGptSocket } from '#utils/ws/handleGptMessage.ts'
import { listRuntimeContainers, removeRuntimeContainer } from '#utils/docker/engine.ts'
import { BROWSER_WARM_MAX_AGE_MS } from '#utils/ws/browserWarmPool.ts'
import { proxyModelSocket } from '#utils/ws/proxyModelSocket.ts'
import { browserWarmPool } from './ws/browserWarmPool.ts'
import { registerBrowserSessionRoutes } from './ws/sessionRoutes.ts'
import { registerBrowserStreamRoute, proxyBrowserStreamSocket } from './ws/browserStream.ts'
import { createShareTerminal, handleShareTerminalMessage, sendTerminalUpdate } from './ws/shareTerminal.ts'
import { recordWebsocketFailure } from './ws/protocol.ts'
import { testClients, shareClients, pendingUpdates } from './ws/state.ts'

export { testClients, shareClients, pendingUpdates, proxyBrowserStreamSocket }

export default fp(async function wsPlugin(fastify: FastifyInstance) {
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY === '1') {
        registerBrowserSessionRoutes(fastify)
        return
    }

    registerVmConsole(fastify)
    registerInternalVmConsole(fastify)
    registerHostConsole(fastify)
    registerSystemStream(fastify)
    registerSupportProxyStream(fastify)

    fastify.get('/api/ws/thesis', { websocket: true }, (socket, request) => {
        const credentials = thesisCredentials(request)
        void thesisMember(credentials.id, credentials.token).then(member => {
            if (!member) socket.close(1008, 'Hanasand organization membership is required.')
            else subscribeThesis(socket)
        }).catch(() => socket.close(1011))
    })
    registerBrowserStreamRoute(fastify)
    if (process.env.NODE_ENV === 'production' && process.env.DEPLOYMENT_CANDIDATE_ONLY !== '1' && process.env.BROWSER_SANDBOX_EGRESS_FIREWALL_READY === '1') {
        const maintain = () => {
            void browserWarmPool.replenish()
            void listRuntimeContainers().then(containers => Promise.all(containers
                .filter(container => container.name.startsWith('hanasand_browser_warm_used_') && Date.now() - Date.parse(container.created_at) > BROWSER_WARM_MAX_AGE_MS)
                .map(container => removeRuntimeContainer(container.id))))
                .catch(error => fastify.log.error(error, 'Browser pool cleanup failed'))
        }
        let timer: ReturnType<typeof setInterval>
        fastify.addHook('onReady', async () => { maintain(); timer = setInterval(maintain, 5000); timer.unref() })
        fastify.addHook('onClose', async () => { clearInterval(timer) })
    }

    fastify.get('/api/ws/test/:id', { websocket: true }, (connection, req: FastifyRequest) => {
        const id = (req.params as { id: string }).id
        registerClient(id, connection, testClients)
        void import('../handlers/test/follow.ts').then(({ startLoadTestQueue }) => startLoadTestQueue())
        connection.on('error', error => { void recordWebsocketFailure('test-client', id, error) })
        connection.on('close', () => removeClient(id, connection, testClients))
    })

    fastify.get<{ Params: { id: string } }>('/api/ws/share/:id', { websocket: true }, (connection, req) => {
        const id = req.params.id
        registerClient(id, connection, shareClients)
        connection.on('message', message => {
            void import('#utils/ws/handleMessage.ts').then(({ handleMessage }) => handleMessage(id, connection, message, shareClients))
        })
        connection.on('error', error => { void recordWebsocketFailure('share-client', id, error) })
        connection.on('close', () => removeClient(id, connection, shareClients))
    })

    fastify.get<{ Params: { alias: string; user: string; session: string } }>('/api/ws/share/:alias/shell/:user/:session', { websocket: true }, (connection, req) => {
        const { alias, user, session } = req.params
        const terminal = createShareTerminal(alias)
        sendTerminalUpdate(connection, `Connected to ${terminal.label}\r\n${terminal.prompt}`)
        connection.send(JSON.stringify({
            type: 'terminal_credentials',
            credentials: { username: user || 'browser', password: '', sshCommand: `browser terminal ${terminal.label}`, domain: 'hanasand.local' },
        }))
        connection.on('message', message => {
            void handleShareTerminalMessage(connection, terminal, message).catch(error => {
                sendTerminalUpdate(connection, `\r\n${error instanceof Error ? error.message : String(error)}\r\n${terminal.prompt}`)
                void recordWebsocketFailure('share-terminal-message', `${alias}:${session}`, error)
            })
        })
        connection.on('error', error => { void recordWebsocketFailure('share-terminal-client', `${alias}:${session}`, error) })
    })

    fastify.get<{ Params: { id: string } }>('/api/client/ws/:id', { websocket: true }, (connection: WebSocket, req: FastifyRequest<{ Params: { id: string } }>) => {
        const id = (req.params as { id: string }).id
        if (proxyModelSocket(connection, id, Boolean(req.headers['x-ai-models-forwarded']))) return
        registerClient(id, connection, gpt, countGptViewers)
        sendGptSnapshot(id, connection)
        connection.on('message', message => handleGptMessage(id, connection, message))
        connection.on('close', () => {
            unregisterGptSocket(id, connection)
            removeClient(id, connection, gpt)
        })
        connection.on('error', error => { void recordWebsocketFailure('gpt-client', id, error) })
    })

    registerBrowserSessionRoutes(fastify)
})
