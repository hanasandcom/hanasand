import type { FastifyReply, FastifyRequest } from 'fastify'
import run, { withTransaction } from '#db'
import { AccountIdentityError, usernameError } from '#utils/auth/accountIdentity.ts'
import login from '#utils/auth/login.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import updatePasswordAndReply from './updatePasswordAndReply.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
    username: string
}

export default async function putSelf(req: FastifyRequest, res: FastifyReply) {
    const auth = await tokenWrapper(req, res)
    if (!auth.valid || auth.impersonating || auth.authenticatedId !== auth.id) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { name, password, avatar, username: requestedUsername } = req.body as GetUserBodyProps ?? {}
    const ip = req.ip
    const id = auth.id
    if (!id || Array.isArray(id)) {
        return res.status(400).send({ error: 'No user provided.' })
    }

    const username = typeof requestedUsername === 'string' ? requestedUsername.trim().toLowerCase() : undefined
    if (requestedUsername !== undefined && (!username || usernameError(username))) {
        const current = await run('SELECT COALESCE(username,id) AS username FROM users WHERE id=$1', [id])
        if (!username || current.rows[0]?.username !== username) return res.status(400).send({ error: usernameError(username || '') || 'Invalid username.' })
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) {
        return res.status(400).send({ error: 'Enter a display name of 1–100 characters.' })
    }

    if (password) {
        return updatePasswordAndReply(req, res, id, password)
    }

    try {
        const fieldsToUpdate: string[] = []
        const values: any[] = []
        let idx = 1

        if (name !== undefined) {
            fieldsToUpdate.push(`name = $${idx}`)
            values.push(name.trim())
            idx++
        }

        if (username !== undefined) {
            fieldsToUpdate.push(`username = $${idx}`)
            values.push(username)
            idx++
        }

        if (avatar !== undefined) {
            fieldsToUpdate.push(`avatar = $${idx}`)
            values.push(avatar)
            idx++
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).send({ error: 'No fields provided to update.' })
        }

        values.push(id)
        const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${idx} RETURNING id,name,COALESCE(username,id) AS username,avatar`

        const response = await withTransaction(async execute => {
            if (username !== undefined) {
                await execute('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`username:${username}`])
                const taken = await execute('SELECT 1 FROM users WHERE id<>$2 AND (lower(COALESCE(username,id))=$1 OR lower(id)=$1)', [username, id])
                if (taken.rows.length) throw new AccountIdentityError('This username is already taken.')
            }
            return execute(query, values)
        })
        if (!response.rowCount) {
            return res.status(404).send({ error: 'User not found.' })
        }

        const updatedUser = response.rows[0]
        const session = await login({ id: updatedUser.id, ip, userAgent: String(req.headers['user-agent'] || '') })

        return res.status(200).send({
            ...updatedUser,
            message: 'User updated',
            token: session?.token ?? null,
            expires_at: session?.expires_at ?? null
        })
    } catch (err) {
        if (err instanceof AccountIdentityError) return res.status(409).send({ error: err.message })
        const error = err as unknown as Error & { code?: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: 'This username is already taken.' })
        }

        return res.status(500).send({ error: error.message })
    }
}
