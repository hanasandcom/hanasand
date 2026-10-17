import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { proxyPasskeyJsonResponse } from '../../proxyJsonResponse'

export async function GET() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys/register/options`, {
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(id ? { id } : {}),
        },
        cache: 'no-store',
    }).catch(() => null)
    return proxyPasskeyJsonResponse(upstream)
}
