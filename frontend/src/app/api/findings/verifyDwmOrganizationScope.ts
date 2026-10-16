import { NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'

export async function verifyDwmOrganizationScope(organizationId: string, token: string, id: string, impersonationToken: string) {
    try {
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}/organizations/${encodeURIComponent(organizationId)}`)
        const response = await fetch(target, {
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${token}`,
                id,
                ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
            },
            signal: AbortSignal.timeout(8000),
        })
        if (response.ok) return null
        const notFound = response.status === 404
        const accessDenied = response.status === 401 || response.status === 403
        return NextResponse.json({
            error: {
                code: notFound ? 'organization_not_found' : accessDenied ? 'organization_access_denied' : 'organization_unavailable',
                message: notFound ? 'Organization not found.' : accessDenied ? 'Organization access denied.' : 'Organization access could not be verified.',
            },
        }, { status: notFound ? 404 : accessDenied ? 403 : 502, headers: { 'cache-control': 'no-store' } })
    } catch {
        return NextResponse.json({ error: { code: 'organization_unavailable', message: 'Organization access could not be verified.' } }, { status: 502 })
    }
}
