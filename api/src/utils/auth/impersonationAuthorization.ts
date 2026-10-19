import type { FastifyRequest } from 'fastify'
import run from '#db'
import { actorHasHanasandInternalAccess, recordSystemEvent } from '#utils/systemEvent.ts'

export function impersonationTargetId(token: string) {
    const match = /^impersonation:([^:]{1,200})$/.exec(token)
    return match?.[1] || null
}

export async function loadImpersonationTarget(actorId: string, token: string) {
    const targetId = impersonationTargetId(token)
    if (!targetId || targetId === actorId || !await actorHasHanasandInternalAccess(actorId)) return null
    const result = await run(`
        SELECT id, name
        FROM users
        WHERE id = $1 AND active IS TRUE AND deletion_scheduled_at IS NULL
        LIMIT 1
    `, [targetId])
    return result.rows[0] as { id: string, name: string } | undefined || null
}

export async function auditImpersonatedRequest(req: FastifyRequest, actor: { id: string, name?: string }, target: { id: string, name: string }) {
    const method = req.method.toUpperCase()
    const path = (req.url || '').split('?')[0]
    const action = ({ GET: 'viewed', HEAD: 'viewed', POST: 'submitted', PUT: 'updated', PATCH: 'updated', DELETE: 'deleted' } as Record<string, string>)[method] || method.toLowerCase()
    const description = `${actor.name || actor.id} ${action} ${path} while impersonating ${target.name || target.id}`
    await recordSystemEvent(req, {
        actionType: 'impersonation.action',
        actorId: actor.id,
        targetType: 'user',
        targetId: target.id,
        severity: 'notice',
        outcome: 'success',
        context: { method, path, description },
    })
}
