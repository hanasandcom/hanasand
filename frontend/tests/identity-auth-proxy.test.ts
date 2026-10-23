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
})
