import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { loginRedirect, publicUrl } from '../src/app/api/auth/sso/redirects'

test('SSO redirects honor forwarded public host and protocol', () => {
    const request = new NextRequest('http://frontend:3000/api/auth/sso/callback', {
        headers: {
            'x-forwarded-host': 'auth.hanasand.com, frontend',
            'x-forwarded-proto': 'https, http',
        },
    })

    assert.equal(publicUrl(request, '/profile').toString(), 'https://auth.hanasand.com/profile')
})

test('SSO error redirects use the canonical production host for internal requests', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
        const request = new NextRequest('http://api:8080/api/auth/sso/start', { headers: { host: 'api:8080' } })
        const response = loginRedirect(request, 'Authentication service is unavailable.')
        const target = new URL(response.headers.get('location') || '')

        assert.equal(target.origin, 'https://hanasand.com')
        assert.equal(target.pathname, '/login')
        assert.equal(target.searchParams.get('error'), 'Authentication service is unavailable.')
    } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = originalNodeEnv
    }
})
