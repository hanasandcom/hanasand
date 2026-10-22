import { NextRequest, NextResponse } from 'next/server'
import { backendDeviceProofTarget } from '@/utils/auth/backendDeviceProofTarget'

export function customerReadProof(request: NextRequest): { id: string; token: string; headers: Record<string, string> } | { response: NextResponse } {
    const supportedPath = request.nextUrl.pathname === '/api/findings/alerts'
        || request.nextUrl.pathname === '/api/cases' && request.nextUrl.searchParams.get('collection') === 'intelligence'
    if (request.method !== 'GET' || !supportedPath) return denied(400)
    const target = backendDeviceProofTarget(request)
    if (!target) return denied(401)
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : request.cookies.get('access_token')?.value || ''
    const id = request.headers.get('id') || request.cookies.get('id')?.value || ''
    if (!token || !id || request.headers.get('x-impersonation-token') || request.cookies.get('impersonation_token')?.value) return denied(401)
    // The scraper performs the single Identity verification and existing exact
    // organization/case-visibility checks. Do not consume this proof here first.
    return { id, token, headers: {
        Authorization: `Bearer ${token}`, id,
        ...(request.headers.get('dpop') ? { DPoP: request.headers.get('dpop')! } : {}),
        'x-device-proof-url': target.url, 'x-device-proof-method': target.method,
    } }
}

function denied(status: number) {
    return { response: NextResponse.json({ error: { code: 'invalid_session', message: 'A valid request session is required.' } }, { status, headers: { 'cache-control': 'no-store' } }) }
}
