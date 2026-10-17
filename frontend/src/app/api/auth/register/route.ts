import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import { authenticatedSessionResponse } from '../_authCookies'
import { authApiUrl, identityApiUrl } from '@/utils/auth/authApiUrl'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'
import { parseAuthRequest, parseAuthJson } from '@/utils/auth/requestBody'

export async function POST(req: NextRequest) {
    const { body, redirectPath, wantsRedirect } = await parseAuthRequest(req, form => ({
        name: String(form.get('name') || ''),
        id: String(form.get('username') || form.get('id') || ''),
        password: String(form.get('password') || ''),
        email: String(form.get('email') || ''),
        challengeId: String(form.get('challengeId') || ''),
        code: String(form.get('code') || ''),
    }))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const password = body?.password
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!name || !id || !password || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/signup', 'Name, username, valid email, and password are required.')
        }
        return NextResponse.json({ error: 'Name, username, valid email, and password are required.' }, { status: 400 })
    }
    if (reservedUsernames.includes(id.toLowerCase())) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/signup', 'This username is reserved.')
        }
        return NextResponse.json({ error: 'This username is reserved.' }, { status: 400 })
    }

    const upstream = await fetch(`${authApiUrl()}/user`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, id, password, email, challengeId: body?.challengeId, code: body?.code }),
        cache: 'no-store',
    }).catch(() => null)
    if (!upstream) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/signup', 'Authentication service is unavailable.')
        }
        return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 502 })
    }
    const responseText = await upstream.text()
    const data = parseAuthJson(responseText)

    if (!upstream.ok) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/signup', String(data?.error || responseText || 'Unable to create account.'))
        }
        return NextResponse.json(data || { error: responseText || 'Unable to create account.' }, { status: upstream.status })
    }
    if (upstream.status === 202 && data?.verificationRequired) {
        return NextResponse.json(data, { status: 202 })
    }
    if (!data?.id || !data?.name) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/login', 'Your account was created. Please log in to continue.')
        }
        return NextResponse.json({ accountCreated: true, error: 'Your account was created. Please log in to continue.' }, { status: 502 })
    }

    const loginData = data.token ? data : await createLoginSession(req, data.id, password)
    if (!loginData?.token || !loginData?.id || !loginData?.name) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, '/login', 'Your account was created. Please log in to continue.')
        }
        return NextResponse.json({ accountCreated: true, error: 'Your account was created. Please log in to continue.' }, { status: 502 })
    }

    return authenticatedSessionResponse(req, loginData, wantsRedirect, redirectPath)
}

async function createLoginSession(req: NextRequest, id: string, password: string) {
    const upstream = await fetch(`${identityApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        cache: 'no-store',
    }).catch(() => null)

    if (!upstream?.ok) {
        return null
    }

    return parseAuthJson(await upstream.text())
}

function authRedirect(redirectPath: string, path: string, error: string) {
    const search = new URLSearchParams({ error, path: safeRedirectPath(redirectPath) })
    return redirectTo(`${path}${path.includes('?') ? '&' : '?'}${search.toString()}`)
}

function redirectTo(path: string) {
    return new NextResponse(null, {
        status: 303,
        headers: { Location: path },
    })
}
