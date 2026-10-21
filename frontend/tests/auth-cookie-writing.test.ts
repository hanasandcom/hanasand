// @ts-expect-error Bun exposes the module mocking API to tests.
import { expect, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookies, setAuthCookies } from '../src/app/api/auth/_authCookies'
import { applyRefreshedAuthCookies, authCookieOptions, setAuthCookie } from '../src/utils/proxy/authResponses'

const expiresAt = new Date('2030-01-02T03:04:05.000Z')

test('local auth cookies keep host-only scope and standard attributes', () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login')
    const response = new NextResponse(null)

    setAuthCookies(request, response, { id: 'user-1', name: 'Test', token: 'local-token', expires_at: expiresAt.toISOString() })

    const token = response.cookies.get('access_token')
    expect(token).toMatchObject({
        name: 'access_token', value: 'local-token', path: '/', secure: false,
        sameSite: 'lax', expires: expiresAt,
    })
    expect(token?.domain).toBeUndefined()
    expect(response.cookies.get('id')?.value).toBe('user-1')
    expect(response.cookies.get('avatar')?.value).toBe('')
    expect(response.headers.getSetCookie()).toContainEqual(expect.stringMatching(/^access_token=local-token; Path=\//))
})
test('shared auth cookies emit the configured shared-domain scope and attributes', () => {
    const request = new NextRequest('http://internal.test/api/auth/login', {
        headers: { host: 'internal.test', 'x-forwarded-host': 'app.hanasand.com:443, internal.test' },
    })
    const response = new NextResponse(null)

    setAuthCookies(request, response, { token: 'shared-token', expires_at: expiresAt.toISOString() })

    const tokenCookies = response.headers.getSetCookie().filter(cookie => cookie.startsWith('access_token='))
    expect(tokenCookies).toHaveLength(1)
    expect(tokenCookies[0]).toContain('Path=/')
    expect(tokenCookies[0]).toContain('Expires=Wed, 02 Jan 2030 03:04:05 GMT')
    expect(tokenCookies[0]).toContain('Domain=.hanasand.com')
    expect(tokenCookies[0]).toContain('Secure')
    expect(tokenCookies[0]).toContain('SameSite=lax')
})

test('shared writer honors host-derived options for backend token refreshes', () => {
    const request = new NextRequest('http://local.test/api/backend', {
        headers: { host: 'local.test' },
    })
    const response = new NextResponse(null)
    const { sharedDomain, ...options } = authCookieOptions(request)

    setAuthCookie(response, 'access_token', 'refreshed-token', { ...options, expires: expiresAt }, sharedDomain)

    expect(response.cookies.getAll()).toEqual([{
        name: 'access_token', value: 'refreshed-token', sameSite: 'lax',
        path: '/', secure: false, expires: expiresAt,
    }])
})

test('refreshed shared sessions extend the account ID cookie with the token expiry', () => {
    const request = new NextRequest('https://cdn.hanasand.com/gallery')
    const response = new NextResponse(null)

    applyRefreshedAuthCookies(response, authCookieOptions(request), {
        id: 'user-1',
        token: 'refreshed-token',
        expires_at: expiresAt.toISOString(),
    })

    const idCookies = response.headers.getSetCookie().filter(cookie => cookie.startsWith('id='))
    expect(idCookies).toHaveLength(1)
    expect(idCookies[0]).toContain('id=user-1')
    expect(idCookies[0]).toContain('Expires=Wed, 02 Jan 2030 03:04:05 GMT')
    expect(idCookies[0]).toContain('Domain=.hanasand.com')
})

test('clearing auth expires local and legacy cookies with shared-domain scope', () => {
    const request = new NextRequest('https://app.hanasand.com/api/auth/logout')
    const response = new NextResponse(null)

    clearAuthCookies(request, response)

    const cookies = response.headers.getSetCookie()
    for (const name of ['name', 'id', 'avatar', 'access_token', 'session_expires_at', 'auth_checked_at']) {
        const hostCookie = cookies.find(cookie => cookie.startsWith(`${name}=`) && !cookie.includes('Domain='))
        expect(hostCookie).toContain('Path=/')
        expect(hostCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')

        const sharedCookie = cookies.find(cookie => cookie.startsWith(`${name}=`) && cookie.includes('Domain='))
        expect(sharedCookie).toContain('Path=/')
        expect(sharedCookie).toContain('Domain=.hanasand.com')
        expect(sharedCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
        expect(sharedCookie).toContain('SameSite=Lax')
        expect(sharedCookie).toContain('Secure')
    }
    const legacyCookie = cookies.find(cookie => cookie.startsWith('roles='))
    expect(legacyCookie).toContain('Path=/')
    expect(legacyCookie).toContain('Domain=.hanasand.com')
    expect(legacyCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    expect(legacyCookie).toContain('SameSite=Lax')
    expect(legacyCookie).toContain('Secure')
})
