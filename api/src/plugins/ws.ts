import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import registerSystemStream from '../handlers/metrics/systemStream.ts'
import registerVmConsole from '../handlers/vms/console.ts'
import registerInternalVmConsole from '../handlers/vms/consoleInternal.ts'
import registerHostConsole from '../handlers/hostConsole.ts'
import { subscribeThesis } from '#utils/thesis.ts'
import { thesisMember } from '#utils/thesisAccess.ts'
import { registerClient } from '#utils/ws/registerClient.ts'
import { removeClient } from '#utils/ws/removeClient.ts'
import { createShareTerminal, handleShareTerminalMessage, sendTerminalUpdate } from './ws/shareTerminal.ts'
import { recordWebsocketFailure } from './ws/protocol.ts'
import { testClients, shareClients, pendingUpdates } from './ws/state.ts'
import { deviceProofFromRequest } from '#utils/auth/deviceProofRequest.ts'
import { deviceProofFromWebSocket } from '#utils/auth/deviceProofRequest.ts'

export { testClients, shareClients, pendingUpdates }

export default fp(async function wsPlugin(fastify: FastifyInstance) {
    registerVmConsole(fastify)
    registerInternalVmConsole(fastify)
    registerHostConsole(fastify)
    registerSystemStream(fastify)

    fastify.get('/api/ws/thesis', { websocket: true }, (socket, request) => {
        let authenticating = false
        let authenticated = false
        const origin = request.headers.origin
        if (origin && origin !== 'https://hanasand.com' && origin !== 'https://www.hanasand.com') {
            socket.close(1008)
            return
        }
        const deadline = setTimeout(() => socket.close(1008), 10000)
        socket.on('close', () => clearTimeout(deadline))
        socket.on('message', raw => {
            if (authenticating || authenticated) return socket.close(1008)
            authenticating = true
            void (async () => {
                try {
                    if (Buffer.byteLength(raw.toString()) > 4096) throw new Error('Invalid authentication')
                    const auth = JSON.parse(raw.toString())
                    const proof = deviceProofFromWebSocket(request, auth?.dpop)
                    if (auth?.type !== 'auth' || typeof auth.id !== 'string' || typeof auth.token !== 'string'
                        || auth.id.length > 200 || auth.token.length > 512
                        || !await thesisMember(auth.id, auth.token, proof)) throw new Error('Unauthorized')
                    if (socket.readyState !== WebSocket.OPEN) return
                    authenticated = true
                    clearTimeout(deadline)
                    subscribeThesis(socket)
                } catch {
                    socket.close(1008, 'Hanasand organization membership is required.')
                }
            })()
        })
    })

    fastify.get('/api/ws/test/:id', { websocket: true }, (connection, req: FastifyRequest) => {
        const id = (req.params as { id: string }).id
        registerClient(id, connection, testClients)
        void import('../handlers/test/follow.ts').then(({ startLoadTestQueue }) => startLoadTestQueue())
        connection.on('error', error => { void recordWebsocketFailure('test-client', id, error) })
        connection.on('close', () => removeClient(id, connection, testClients))
    })

    fastify.get<{ Params: { id: string } }>('/api/ws/share/:id', { websocket: true }, (connection, req) => {
        const id = req.params.id
        const proofUrl = deviceProofFromRequest(req).url
        registerClient(id, connection, shareClients)
        connection.on('message', message => {
            void import('#utils/ws/handleMessage.ts').then(({ handleMessage }) => handleMessage(id, connection, message, shareClients, proofUrl))
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

})
