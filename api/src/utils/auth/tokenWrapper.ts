import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from './session.ts'
import { deviceProofFromRequest } from './deviceProofRequest.ts'
import { isTransientDatabaseError } from '#db'
import { auditImpersonatedRequest, loadImpersonationTarget, impersonationTargetId } from './impersonationAuthorization.ts'

type Valid = {
    valid: boolean
    id?: string
    authenticatedId?: string
    impersonating?: boolean
    error?: string
}

type ImpersonationTarget = {
    id: string
    name: string
}

function headerValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

/**
 * Token wrapper helper function. Used to check whether a `token` is valid
 * before allowing API access, for example when updating and deleting packages
 * from the `allow` or `block` lists.
 *
 * @param req Fastify Request
 * @param res Fastify Response
 *
 * @returns Object with a `valid` parameter, and optionally an `error` parameter
 * if an error occured while verifying the token.
 */
export default async function tokenWrapper(req: FastifyRequest, res: FastifyReply, validate = validateSession): Promise<Valid> {
    const authHeader = req.headers['authorization']
    const id = headerValue(req.headers['id'])
    const impersonationToken = headerValue(req.headers['x-impersonation-token'])
    const cachedSession = (req as FastifyRequest & {
        rateLimitSession?: Awaited<ReturnType<typeof validateSession>>
    }).rateLimitSession
    const apiKeyAuth = (req as FastifyRequest & {
        apiKeyAuth?: {
            ownerId: string
        }
    }).apiKeyAuth
    const requestState = req as FastifyRequest & { impersonationAuth?: { token: string, result: Valid } }

    if (impersonationToken && requestState.impersonationAuth?.token === impersonationToken) {
        return requestState.impersonationAuth.result
    }

    if (apiKeyAuth?.ownerId) {
        if (impersonationToken) return { valid: false, id: apiKeyAuth.ownerId, error: 'Service accounts cannot impersonate users.' }
        req.headers.id = apiKeyAuth.ownerId
        return {
            valid: true,
            id: apiKeyAuth.ownerId,
        }
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            valid: false,
            id,
            error: 'Unauthorized.'
        }
    }

    const token = authHeader.split(' ')[1]

    try {
        const session = cachedSession && cachedSession.user.id === id && cachedSession.session.token === token
            ? cachedSession
            : await validate({ id, token, deviceProof: deviceProofFromRequest(req) })
        if (!session) {
            return {
                valid: false,
                id,
                error: 'Unauthorized.'
            }
        }

        let effectiveId = session.user.id
        let target: ImpersonationTarget | null = null
        let impersonating = false
        if (impersonationToken) {
            const targetId = impersonationTargetId(impersonationToken)
            const loadedTarget = await loadImpersonationTarget(session.user.id, impersonationToken)
            if (!targetId || !loadedTarget) {
                return {
                    valid: false,
                    id: session.user.id,
                    authenticatedId: session.user.id,
                    error: 'Impersonation is not authorized.'
                }
            }
            effectiveId = loadedTarget.id
            target = loadedTarget
            impersonating = true
        }

        req.headers.id = effectiveId
        if (impersonating) {
            req.headers['x-authenticated-id'] = session.user.id
        }
        res.header('x-access-token', session.refreshed.token)
        res.header('x-access-token-expires-at', session.refreshed.expires_at)
        if (impersonating) {
            res.header('x-impersonating-id', effectiveId)
            if (target?.name) {
                res.header('x-impersonating-name', target.name)
            }
            res.header('x-authenticated-id', session.user.id)
            await auditImpersonatedRequest(req, { id: session.user.id, name: session.user.name }, target!)
        }
        const result = { valid: true, id: effectiveId, authenticatedId: session.user.id, impersonating }
        if (impersonating) requestState.impersonationAuth = { token: impersonationToken!, result }
        return result
    } catch (error) {
        res.log.error(error)
        const code = (error as { code?: string }).code
        if (code === 'DB_QUEUE_FULL' || isTransientDatabaseError(error)) {
            const preview = req.url.split('?')[0] === '/api/rules/preview'
            const message = preview
                ? 'Preview is temporarily busy. Try again shortly.'
                : 'Database is temporarily busy. Try again shortly.'
            res.header('retry-after', '1').status(503).send({
                valid: false,
                id,
                error: message,
            })
            return { valid: false, id, error: message }
        }
        res.status(500).send({
            valid: false,
            id,
            error: 'Internal server error'
        })

        return {
            valid: false,
            id,
            error: 'Internal server error'
        }
    }
}
