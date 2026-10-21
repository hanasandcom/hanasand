import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { clientHeaders } from '@/utils/auth/clientHeaders'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const actorId = cookieStore.get('id')?.value || ''
    const accessToken = cookieStore.get('access_token')?.value || ''
    if (!actorId || !accessToken) {
        return NextResponse.json({ error: 'Log in again before impersonating a user.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { target_id?: string, targetId?: string }
    const response = await fetch(`${identityApiUrl().replace(/\/+$/, '')}/impersonation/start`, {
        method: 'POST',
        headers: { ...clientHeaders(req), 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, id: actorId },
        body: JSON.stringify({ targetId: body.targetId || body.target_id }),
        cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({})) as {
        token?: string
        target?: { id?: string, name?: string }
        error?: string
        expiresAt?: string
    }
    if (!response.ok || !payload.token || !payload.target?.id) {
        return NextResponse.json({ error: payload.error || 'Unable to start impersonation.' }, { status: response.status || 502 })
    }

    const next = NextResponse.json({ target: payload.target })
    const expires = payload.expiresAt ? new Date(payload.expiresAt) : new Date(Date.now() + 12 * 60 * 60 * 1000)
    const cookie = { sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', expires }
    next.cookies.set('impersonation_token', payload.token, cookie)
    next.cookies.set('impersonating_id', payload.target.id, cookie)
    next.cookies.set('impersonating_name', payload.target.name || payload.target.id, cookie)
    return next
}
