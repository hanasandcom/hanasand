import type { FastifyReply, FastifyRequest } from 'fastify'
import { validatePassword } from '#utils/auth/password.ts'
import updateUserPassword from './updateUserPassword.ts'

export default async function updatePasswordAndReply(
    req: FastifyRequest,
    res: FastifyReply,
    userId: string,
    password: string,
) {
    const validation = await validatePassword(password)
    if (!validation.valid) {
        return res.status(400).send({ error: validation.error })
    }

    try {
        const session = await updateUserPassword({
            userId,
            password,
            ip: req.ip,
            userAgent: String(req.headers['user-agent'] || ''),
        })
        if (!session.userFound) {
            return res.status(400).send({ error: 'User not found.' })
        }
        if (!session.session) {
            return res.status(206).send({
                message: 'Password updated, and you were logged out. Logging you back in was not possible due to an unknown error.',
                error: 'Unable to login. Please try again later.'
            })
        }

        return res.status(201).send({ message: 'Password updated', token: session.session.token, expires_at: session.session.expires_at })
    } catch (error) {
        console.error(`Database error: ${JSON.stringify(error)}`)
        return res.status(500).send({ error: 'Internal Server Error' })
    }
}
