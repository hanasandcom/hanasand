import { afterEach, expect, mock, test } from 'bun:test'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'

const auth: {
    authenticate: (req: FastifyRequest, res: FastifyReply) => Promise<{ valid: boolean, id?: string, error?: string }>
} = {
    authenticate: async () => ({ valid: false, error: 'Unauthorized.' }),
}

mock.module('#utils/auth/tokenWrapper.ts', () => ({
    default: (...args: [FastifyRequest, FastifyReply]) => auth.authenticate(...args),
}))
mock.module('#db', () => ({ default: async () => ({ rows: [] }) }))
mock.module('#utils/ws/handleGptMessage.ts', () => ({ gpt: new Map(), listGptClients: () => [] }))
mock.module('../src/handlers/ai/runtime.ts', () => ({ buildAiRuntimeState: () => ({}) }))
mock.module('#utils/ai/repoCredentials.ts', () => ({ toRepoCredentialSummary: () => null }))
mock.module('../src/handlers/ai/deploymentShared.ts', () => ({ getDeployQuota: async () => ({}), toDeployment: (row: unknown) => row }))
mock.module('../src/handlers/ai/releaseShared.ts', () => ({ toReleaseBase: (row: unknown) => row }))

const { requireAiUser } = await import('../src/handlers/ai/shared.ts')

afterEach(() => {
    auth.authenticate = async () => ({ valid: false, error: 'Unauthorized.' })
})

test('AI authentication sends the standard unauthorized response', async () => {
    const app = Fastify()
    app.get('/ai', async (req, res) => {
        const userId = await requireAiUser(req, res)
        if (!userId) return
        return res.send({ userId })
    })

    try {
        const response = await app.inject('/ai')
        expect(response.statusCode).toBe(401)
        expect(response.json()).toEqual({ error: 'Unauthorized.' })
    } finally {
        await app.close()
    }
})

test('AI authentication preserves an upstream error response already sent by tokenWrapper', async () => {
    auth.authenticate = async (_req, res) => {
        res.status(503).send({ error: 'Database is temporarily busy.' })
        return { valid: false, error: 'Database is temporarily busy.' }
    }
    const app = Fastify()
    app.get('/ai', async (req, res) => {
        const userId = await requireAiUser(req, res)
        if (!userId) return
        return res.send({ userId })
    })

    try {
        const response = await app.inject('/ai')
        expect(response.statusCode).toBe(503)
        expect(response.json()).toEqual({ error: 'Database is temporarily busy.' })
    } finally {
        await app.close()
    }
})
