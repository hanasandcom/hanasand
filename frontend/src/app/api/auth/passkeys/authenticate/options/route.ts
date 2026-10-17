import { NextRequest } from 'next/server'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { proxyPasskeyJsonResponse } from '../../proxyJsonResponse'

export async function GET(req: NextRequest) {
    const target = new URL(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys/authenticate/options`)
    const username = req.nextUrl.searchParams.get('username')
    if (username) {
        target.searchParams.set('username', username)
    }
    const upstream = await fetch(target, { cache: 'no-store' }).catch(() => null)
    return proxyPasskeyJsonResponse(upstream)
}
