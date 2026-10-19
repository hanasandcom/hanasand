
import 'fastify'

declare module 'fastify' {
    interface FastifyRequest {
        caseBoundaryTiming?: string[]
    }
    interface FastifyInstance {
        systemSnapshot?: Buffer
        stats: Buffer
        docker: Buffer
    }
}
