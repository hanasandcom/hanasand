import type { FastifyReply, FastifyRequest } from 'fastify'
import { validateSession } from './session.ts'
import { isTransientDatabaseError } from '#db'
import {
    auditImpersonationRequest,
    auditImpersonationScopeDenied,
    getImpersonationSession,
    isImpersonationScopeAllowed,
    isSensitiveImpersonatedRequest,
    type ImpersonationSession,
} from './impersonationAuthorization.ts'

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
        apiKeyAuth?: {
            ownerId: string
        }
    }).rateLimitSession
    const apiKeyAuth = (req as FastifyRequest & {
        apiKeyAuth?: {
            ownerId: string
        }
    }).apiKeyAuth

    if (apiKeyAuth?.ownerId) {
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
        const session = cachedSession && cachedSession.user.id === id
            ? cachedSession
            : await validate({ id, token })
        if (!session) {
            return {
                valid: false,
                id,
                error: 'Unauthorized.'
            }
        }

        let effectiveId = session.user.id
        let target: ImpersonationTarget | null = null
        let impersonationSessionId: string | undefined
        let impersonating = false
        let activeImpersonationSession: ImpersonationSession | null = null
        if (impersonationToken) {
            const serverSession = await getImpersonationSession(impersonationToken, session.user.id)
            if (!serverSession) {
                return {
                    valid: false,
                    id: session.user.id,
                    authenticatedId: session.user.id,
                    error: 'Impersonation session expired.'
                }
            }
            effectiveId = serverSession.object_id
            target = { id: serverSession.object_id, name: serverSession.target_name }
            impersonationSessionId = serverSession.id
            activeImpersonationSession = serverSession
            impersonating = true
        }

        if (impersonating && isSensitiveImpersonatedRequest(req)) {
            return {
                valid: false,
                id: effectiveId,
                authenticatedId: session.user.id,
                impersonating: true,
                error: 'Return to own view before changing account, security, or system settings.'
            }
        }

        if (impersonating && activeImpersonationSession && !isImpersonationScopeAllowed(req, activeImpersonationSession)) {
            void auditImpersonationScopeDenied(req, activeImpersonationSession)
            return {
                valid: false,
                id: effectiveId,
                authenticatedId: session.user.id,
                impersonating: true,
                error: 'Impersonation scope does not allow this request.'
            }
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
            if (impersonationSessionId) {
                res.header('x-impersonation-session-id', impersonationSessionId)
            }
            void auditImpersonationRequest(req, session.user.id, effectiveId, impersonationSessionId)
        }
        return { valid: true, id: effectiveId, authenticatedId: session.user.id, impersonating }
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
