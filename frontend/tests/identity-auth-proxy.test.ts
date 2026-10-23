import { describe, expect, it } from 'bun:test'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'
import { identityAuthUrl } from '../src/utils/auth/identityRedirect'

describe('Identity auth entry redirects', () => {
    it.each([
        ['/login?path=%2Forganizations', 'login', '/organizations'],
        ['/login?mode=signup&path=%2Forganizations', 'signup', '/organizations'],
        ['/signup?path=%2Forganizations', 'signup', '/organizations'],
        ['/register?path=%2Forganizations', 'signup', '/organizations'],
    ] as const)('returns a direct redirect for %s', async (path, page, returnPath) => {
        const response = await proxy(new NextRequest(`https://hanasand.com${path}`))

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(identityAuthUrl(page, returnPath))
    })

    it('keeps staging sign-in local and routes unavailable account flows back to sign-in', async () => {
        const previous = process.env.HANASAND_STAGING_LOCAL_AUTH_UI
        process.env.HANASAND_STAGING_LOCAL_AUTH_UI = '1'
        try {
            const login = await proxy(new NextRequest('http://127.0.0.1:3280/login?path=%2Fai'))
            expect(login.status).toBe(200)
            expect(login.headers.get('x-middleware-next')).toBe('1')

            const signup = await proxy(new NextRequest('http://127.0.0.1:3280/signup?path=%2Fai'))
            expect(signup.status).toBe(307)
            const signupDestination = new URL(signup.headers.get('location')!)
            expect(signupDestination.pathname).toBe('/login')
            expect(signupDestination.search).toBe('?path=%2Fai')
        } finally {
            if (previous === undefined) delete process.env.HANASAND_STAGING_LOCAL_AUTH_UI
            else process.env.HANASAND_STAGING_LOCAL_AUTH_UI = previous
        }
    })
})
