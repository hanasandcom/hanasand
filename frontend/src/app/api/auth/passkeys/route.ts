import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { proxyPasskeyJsonResponse } from './proxyJsonResponse'

export async function GET() {
    const headers = await authHeaders()
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys`, {
        headers,
        cache: 'no-store',
    }).catch(() => null)
    return proxyPasskeyJsonResponse(upstream)
}

async function authHeaders() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(id ? { id } : {}),
    }
}
