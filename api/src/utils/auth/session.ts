const identityApiUrl = (process.env.HANASAND_IDENTITY_SERVICE_URL || 'http://identity:8081').replace(/\/+$/, '')

export type SessionOrganizationMembership = {
    organizationId: string
    organizationStatus: string
    membershipStatus: string
    role: string
}

export type SessionValidation = {
    user: {
        id: string
        name: string
        avatar: string
        active: boolean
        deletion_scheduled_at?: string | null
    }
    session: {
        token_id: number
        id: string
        token: string
        ip: string
        user_agent: string
        created_at: string
        timestamp: string
        database_read_only?: boolean
    }
    organizationMember?: boolean
    organizationMembership?: SessionOrganizationMembership | null
    refreshed: { token: string; expires_at: string }
}

export type SessionListRow = {
    token_id: number
    id: string
    ip: string
    user_agent: string
    created_at: string
    last_seen_at: string
    revoked_at: string | null
    current: boolean
}

const IDENTITY_SESSION_UNAUTHORIZED = Symbol('identity-session-unauthorized')

async function requestSessionOperation<T>(operation: string, body: Record<string, unknown>): Promise<T | typeof IDENTITY_SESSION_UNAUTHORIZED> {
    const serviceToken = process.env.HANASAND_IDENTITY_SERVICE_TOKEN
    if (!serviceToken) throw new Error('Identity service credentials are not configured.')

    const response = await fetch(`${identityApiUrl}/api/auth/internal/sessions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${serviceToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, operation }),
        signal: AbortSignal.timeout(5000),
    })

    if (response.status === 401) return IDENTITY_SESSION_UNAUTHORIZED
    if (!response.ok) throw new Error(`Identity session operation failed (${response.status}).`)
    return await response.json() as T
}

export async function issueToken({ id, ip, userAgent = '' }: { id: string, ip: string, userAgent?: string }) {
    const result = await requestSessionOperation<{ token: string; expires_at: string }>('issue', { id, ip, userAgent })
    return result === IDENTITY_SESSION_UNAUTHORIZED ? null : result
}

export async function validateSession({ id, token, organizationSlug }: { id?: string, token: string, organizationSlug?: string }): Promise<SessionValidation | null> {
    if (!token) return null
    const result = await requestSessionOperation<SessionValidation>('validate', { id, token, organizationSlug })
    return result === IDENTITY_SESSION_UNAUTHORIZED ? null : result
}

export async function revokeToken({ tokenId, userId, revokedBy }: { tokenId: number, userId: string, revokedBy: string }) {
    const result = await requestSessionOperation<{ revoked: boolean }>('revoke', { tokenId, id: userId, revokedBy })
    if (result === IDENTITY_SESSION_UNAUTHORIZED) return false
    return result?.revoked === true
}

export async function revokeAllTokens({ userId, revokedBy, exceptToken }: { userId: string, revokedBy: string, exceptToken?: string }) {
    const result = await requestSessionOperation<{ revoked: number }>('revoke-all', { id: userId, revokedBy, exceptToken })
    if (result === IDENTITY_SESSION_UNAUTHORIZED) return null
    const revoked = result && typeof result === 'object' ? (result as { revoked?: unknown }).revoked : undefined
    if (typeof revoked !== 'number' || !Number.isSafeInteger(revoked) || revoked < 0) {
        throw new Error('Identity session operation returned an invalid revocation count.')
    }
    return revoked
}

export async function listSessions(userId: string, currentToken?: string) {
    const result = await requestSessionOperation<SessionListRow[]>('list', { id: userId, token: currentToken })
    return result === IDENTITY_SESSION_UNAUTHORIZED ? [] : result || []
}
