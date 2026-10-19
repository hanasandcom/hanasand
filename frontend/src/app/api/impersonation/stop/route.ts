import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { identityApiUrl } from '@/utils/auth/authApiUrl'

export async function POST() {
    const cookieStore = await cookies()
    const actorId = cookieStore.get('id')?.value || ''
    const accessToken = cookieStore.get('access_token')?.value || ''
    const impersonationToken = cookieStore.get('impersonation_token')?.value || ''
    if (actorId && accessToken && impersonationToken) {
        const response = await fetch(`${identityApiUrl().replace(/\/+$/, '')}/impersonation/stop`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, id: actorId, 'x-impersonation-token': impersonationToken },
            cache: 'no-store',
        }).catch(() => null)
        if (response && !response.ok) {
            return NextResponse.json({ error: 'Unable to end impersonation.' }, { status: response.status })
        }
    }

    const next = NextResponse.json({ ok: true })
    for (const name of ['impersonation_token', 'impersonating_id', 'impersonating_name']) {
        next.cookies.set(name, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
    }
    return next
}
