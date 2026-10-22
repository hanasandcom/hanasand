import { NextRequest, NextResponse } from 'next/server'
import tokenIsValid from './tokenIsValid'
import { canViewHanasandInternalRoute } from '../../../../api/src/utils/auth/organizationPagePolicy'

export type ApiSessionIdentity = {
    id: string
    token: string
    canEditInternalPages: boolean
}

export default async function requireApiSession(request: NextRequest): Promise<{ identity: ApiSessionIdentity } | { response: NextResponse }> {
    const token = request.cookies.get('access_token')?.value || bearerToken(request.headers.get('authorization'))
    const id = request.cookies.get('id')?.value || request.headers.get('id') || ''
    if (!token || !id) return { response: authError(401, 'authentication_required', 'A valid Hanasand session is required.') }

    const internalContext = request.nextUrl.pathname.startsWith('/api/thesis')
        || canViewHanasandInternalRoute(request.method, request.nextUrl.pathname)
    const validation = await tokenIsValid(token, id, request.cookies.get('impersonation_token')?.value, {
        includeInternalAccess: internalContext,
    })
    if (!validation.valid) {
        return {
            response: authError(
                validation.state === 'unavailable' ? 503 : 401,
                validation.state === 'unavailable' ? 'authentication_service_unavailable' : 'invalid_session',
                validation.state === 'unavailable' ? 'Authentication service is temporarily unavailable.' : 'The Hanasand session is invalid or expired.',
            ),
        }
    }

    if (canViewHanasandInternalRoute(request.method, request.nextUrl.pathname) && !validation.canViewInternalPages) {
        return { response: authError(403, 'organization_access_required', 'Active Hanasand organization owner or editor access is required.') }
    }

    return { identity: { id, token: validation.token || token, canEditInternalPages: validation.canEditInternalPages === true } }
}

function bearerToken(value: string | null) {
    return value?.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

function authError(status: number, code: string, message: string) {
    return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
}
