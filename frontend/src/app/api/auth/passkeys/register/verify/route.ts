import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { proxyPasskeyJsonResponse } from '../../proxyJsonResponse'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys/register/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        },
        body: await req.text(),
        cache: 'no-store',
    }).catch(() => null)
    return proxyPasskeyJsonResponse(upstream)
}
