import type { FastifyReply, FastifyRequest } from 'fastify'
import run from '#db'
import login from '#utils/auth/login.ts'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'
import updatePasswordAndReply from './updatePasswordAndReply.ts'
import { devicePublicJwkFromRequest } from '#utils/auth/deviceProofRequest.ts'

type GetUserBodyProps = {
    id: string
    name: string
    password: string
    avatar: string
}

export default async function putUser(req: FastifyRequest, res: FastifyReply) {
    const { valid } = await tokenWrapper(req, res)
    const { valid: validRole } = await hasHanasandInternalRouteAccess(req)
    if (!valid || !validRole) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { id } = req.params as { id: string } ?? {}
    const { name, password, avatar } = req.body as GetUserBodyProps ?? {}
    const ip = req.ip

    if (!id) {
        return res.status(400).send({ error: 'No user provided.' })
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
            values.push(name)
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
        const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${idx} RETURNING *`

        const response = await run(query, values)
        if (!response.rowCount) {
            return res.status(404).send({ error: 'User not found.' })
        }

        const updatedUser = response.rows[0]
        const session = await login({ id: updatedUser.id, ip, userAgent: String(req.headers['user-agent'] || ''), devicePublicJwk: devicePublicJwkFromRequest(req) })

        return res.status(200).send({
            ...updatedUser,
            message: 'User updated',
            token: session?.token ?? null,
            expires_at: session?.expires_at ?? null
        })
    } catch (err) {
        const error = err as unknown as Error & { code?: string }
        if (error.code === '23505') {
            return res.status(409).send({ error: 'Duplicate value conflict' })
        }

        return res.status(500).send({ error: error.message })
    }
}
