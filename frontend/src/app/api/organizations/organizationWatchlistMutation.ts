import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from './_organizationApiProxy'
import { organizationWatchlistSession } from './organizationWatchlistSession'

type MutationMethod = 'POST' | 'PUT' | 'DELETE'

export async function proxyOrganizationWatchlistMutation(request: NextRequest, path: string, input: { method: MutationMethod, organizationId: string }) {
    const session = await organizationWatchlistSession(request, path, input.method, input.organizationId)
    if ('response' in session) return session.response
    // Core owns the source save and service projection receipt. Never fan out
    // the original user's one-use proof into a second authorization request.
    return proxyOrganizationApiRequest(request, path, {
        method: input.method, forwardImpersonation: false, verifiedWatchlistSession: session.identity,
    })
}
