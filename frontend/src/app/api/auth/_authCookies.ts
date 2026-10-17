import { NextRequest, NextResponse } from 'next/server'
import { authCookieOptions, setAuthCookie } from '@/utils/proxy/authResponses'
import { safeRedirectPath } from '@/utils/auth/safeRedirectPath'

type AuthPayload = {
    name?: string
    id?: string
    avatar?: string | null
    token?: string
    expires_at?: string | null
}

const authCookieNames = ['name', 'id', 'avatar', 'access_token', 'session_expires_at', 'auth_checked_at'] as const
const legacyAuthCookieNames = ['roles'] as const

export function setAuthCookies(req: NextRequest, response: NextResponse, data: AuthPayload) {
    const expires = data.expires_at ? new Date(data.expires_at) : undefined
    const { sharedDomain, ...baseOptions } = authCookieOptions(req)
    const cookieOptions = {
        expires,
        ...baseOptions,
    }

    if (data.name) {
        setAuthCookie(response, 'name', data.name, cookieOptions, sharedDomain)
    }
    if (data.id) {
        setAuthCookie(response, 'id', data.id, cookieOptions, sharedDomain)
    }
    setAuthCookie(response, 'avatar', data.avatar ?? '', cookieOptions, sharedDomain)
    if (data.token) {
        setAuthCookie(response, 'access_token', data.token, cookieOptions, sharedDomain)
    }
    for (const cookie of legacyAuthCookieNames) {
        response.cookies.delete(cookie)
        if (sharedDomain) response.cookies.set(cookie, '', { ...cookieOptions, expires: new Date(0), domain: sharedDomain })
    }
    if (data.expires_at) {
        setAuthCookie(response, 'session_expires_at', data.expires_at, cookieOptions, sharedDomain)
    }
    setAuthCookie(response, 'auth_checked_at', new Date().toISOString(), cookieOptions, sharedDomain)
}

export function authenticatedSessionResponse(req: NextRequest, data: AuthPayload, wantsRedirect: boolean, redirectPath: string) {
    const response = wantsRedirect
        ? new NextResponse(null, { status: 303, headers: { Location: safeRedirectPath(redirectPath) } })
        : NextResponse.json({
            name: data.name,
            id: data.id,
            avatar: data.avatar ?? null,
            expires_at: data.expires_at ?? null,
        })
    setAuthCookies(req, response, data)
    return response
}

export function clearAuthCookies(req: NextRequest, response: NextResponse) {
    for (const cookie of authCookieNames) {
        response.cookies.delete(cookie)
    }
    expireSharedDomainAuthCookies(req, response)
}

function expireSharedDomainAuthCookies(req: NextRequest, response: NextResponse) {
    const secure = authCookieOptions(req).secure ? '; Secure' : ''
    for (const cookie of [...authCookieNames, ...legacyAuthCookieNames]) {
        response.headers.append('Set-Cookie', `${cookie}=; Path=/; Domain=.hanasand.com; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`)
    }
}
