import type { FastifyInstance } from 'fastify'
import { forwardSupportSocket } from '#utils/support/transport.ts'

export default function registerSupportProxyStream(fastify: FastifyInstance) {
    fastify.get('/api/ws/support', { websocket: true }, socket => {
        if (!forwardSupportSocket(socket)) socket.close(1013)
    })
}
