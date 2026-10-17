import type { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'crypto'
import run from '#db'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'

type NonImpersonatingActor = Awaited<ReturnType<typeof tokenWrapper>> & { id: string }

export async function requireNonImpersonatingActor(req: FastifyRequest, res: FastifyReply): Promise<NonImpersonatingActor | null> {
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.id || actor.impersonating) {
        res.status(401).send({ error: actor.error || 'Unauthorized.' })
        return null
    }
    return actor as NonImpersonatingActor
}

export async function getActiveUser(id: string) {
    const result = await run(`
        SELECT id, name, avatar
        FROM users
        WHERE id = $1
          AND active IS TRUE
          AND deletion_scheduled_at IS NULL
        LIMIT 1
    `, [id])
    return result.rows[0] as { id: string, name: string, avatar?: string | null } | undefined
}
export function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}
export function impersonationError(code: string, message: string, detail: Record<string, unknown> = {}) {
    return {
        error: message,
        detail: {
            schemaVersion: 'support.impersonation.error.v1',
            code,
            outcome: 'denied',
            ...detail,
        },
    }
}
export async function getImpersonationCurrent(req: FastifyRequest, res: FastifyReply) {
    const token = String(req.headers['x-impersonation-token'] || '')
    if (!token) {
        return res.send({ active: false })
    }
    const actor = await tokenWrapper(req, res)
    if (!actor.valid || !actor.impersonating) {
        return res.status(401).send({ error: actor.error || 'Invalid impersonation session.' })
    }
    return res.send({
        active: true,
        actor_id: actor.authenticatedId,
        object_id: actor.id,
    })
}
