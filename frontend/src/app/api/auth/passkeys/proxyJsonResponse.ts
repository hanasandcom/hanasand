import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

type AuthenticatedPasskeyRequest = {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: string
}

export async function proxyAuthenticatedPasskeyRequest(path: string, options: AuthenticatedPasskeyRequest = {}) {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value || ''
    const id = cookieStore.get('id')?.value || ''
    const headers = {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(id ? { id } : {}),
    }
    const method = options.method || 'GET'
    const upstream = await fetch(`${identityApiUrl().replace(/\/$/, '')}/auth/passkeys${path}`, {
        ...(method === 'GET' ? {} : { method }),
        headers,
        ...(options.body === undefined ? {} : { body: options.body }),
        cache: 'no-store',
    }).catch(() => null)
    return proxyPasskeyJsonResponse(upstream)
}

export async function proxyPasskeyJsonResponse(upstream: Response | null) {
    if (!upstream) {
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status })
}
