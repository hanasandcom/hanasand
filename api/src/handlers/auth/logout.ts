import type { FastifyReply, FastifyRequest } from 'fastify'
import { revokeToken, validateSession } from '#utils/auth/session.ts'

export default async function logoutHandler(req: FastifyRequest, res: FastifyReply) {
    const { id: suppliedId } = req.params as { id: string }
    const id = String(suppliedId || '').trim()
    const authorization = req.headers.authorization
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : ''
    res.header('Cache-Control', 'no-store')

    if (!id) {
        return res.status(400).send({ error: 'Missing userId' })
    }
    if (!token) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    try {
        const session = await validateSession({ id, token })
        if (!session || session.user.id !== id) {
            return res.status(401).send({ error: 'Unauthorized.' })
        }

        const revoked = await revokeToken({ tokenId: session.session.token_id, userId: session.user.id, revokedBy: session.user.id })
        if (!revoked) {
            return res.status(200).send({ message: 'No active session found.' })
        }

        return res.status(200).send({
            message: 'Session logged out successfully.',
            invalidatedTokens: 1,
        })
    } catch (error) {
        console.error(`Logout error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal server error' })
    }
}
