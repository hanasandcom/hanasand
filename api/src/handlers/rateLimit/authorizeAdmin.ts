import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import hasHanasandInternalRouteAccess from '#utils/auth/organizationPageAccess.ts'

type AuthorizationOptions = { requireId?: boolean }
type TokenAccess = Awaited<ReturnType<typeof tokenWrapper>>

export function authorizeRateLimitAdmin(
    req: FastifyRequest,
    res: FastifyReply,
    options: { requireId: true },
): Promise<(TokenAccess & { id: string }) | null>
export function authorizeRateLimitAdmin(
    req: FastifyRequest,
    res: FastifyReply,
    options?: { requireId?: false },
): Promise<TokenAccess | null>
export async function authorizeRateLimitAdmin(
    req: FastifyRequest,
    res: FastifyReply,
    { requireId = false }: AuthorizationOptions = {},
): Promise<TokenAccess | null> {
    res.header('Cache-Control', 'no-store')

    const access = await tokenWrapper(req, res)
    if (!access.valid || (requireId && !access.id)) {
        res.status(401).send({ error: access.error || 'Unauthorized.' })
        return null
    }

    const role = await hasHanasandInternalRouteAccess(req)
    if (!role.valid) {
        res.status(403).send({ error: role.error || 'Active Hanasand organization owner or editor access is required.' })
        return null
    }

    return requireId ? access as TokenAccess & { id: string } : access
}
