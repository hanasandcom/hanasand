import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { GET as startSso } from '../src/app/api/auth/sso/start/route'
import { GET as callbackSso } from '../src/app/api/auth/sso/callback/route'
import { loginRedirect, publicUrl, safeSsoReturnTo } from '../src/app/api/auth/sso/redirects'

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

test('SSO return addresses accept only approved HTTPS origins and paths', () => {
    assert.equal(safeSsoReturnTo('https://cdn.hanasand.com/login?path=%2Fgallery'), 'https://cdn.hanasand.com/login?path=%2Fgallery')
    assert.equal(safeSsoReturnTo('https://mail.hanasand.com/'), 'https://mail.hanasand.com/')
    assert.equal(safeSsoReturnTo('https://hanasand.com:443/login'), 'https://hanasand.com/login')
    assert.equal(safeSsoReturnTo('https://attacker.example/login'), null)
    assert.equal(safeSsoReturnTo('https://cdn.hanasand.com.evil.example/login'), null)
    assert.equal(safeSsoReturnTo('https://mail.hanasand.com:8443/'), null)
    assert.equal(safeSsoReturnTo('https://user@mail.hanasand.com/'), null)
    assert.equal(safeSsoReturnTo('https://cdn.hanasand.com/login#token'), null)
    assert.equal(safeSsoReturnTo('javascript:alert(1)'), null)
    assert.equal(safeSsoReturnTo('/login'), null)
})

test('SSO start stores a validated cross-app return address with the current binding cookie', async () => {
    const originalFetch = globalThis.fetch
    let requestBody = ''
    globalThis.fetch = async (_input, init) => {
        requestBody = String(init?.body || '')
        return Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth' })
    }

    try {
        const request = new NextRequest('https://hanasand.com/api/auth/sso/start?returnTo=https%3A%2F%2Fmail.hanasand.com%2F')
        const response = await startSso(request)

        assert.equal(response.status, 303)
        assert.equal(requestBody.includes('redirectPath'), true)
        assert.equal(response.cookies.get('hanasand_auth_binding')?.value.length, 43)
        assert.equal(response.cookies.get('__Host-sso-return-to')?.value, 'https://mail.hanasand.com/')
        assert.equal(response.cookies.get('__Host-sso-oidc'), undefined)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('SSO start rejects unapproved, non-default-port, and duplicated return addresses before contacting Identity', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = async () => {
        fetchCalled = true
        return Response.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth' })
    }

    try {
        for (const query of [
            'returnTo=https%3A%2F%2Fevil.example%2F',
            'returnTo=https%3A%2F%2Fmail.hanasand.com%3A8443%2F',
            'returnTo=https%3A%2F%2Fmail.hanasand.com%2F&returnTo=https%3A%2F%2Fcdn.hanasand.com%2F',
        ]) {
            const response = await startSso(new NextRequest(`https://hanasand.com/api/auth/sso/start?${query}`))
            assert.equal(response.status, 307)
            assert.equal(new URL(response.headers.get('location') || '').searchParams.get('error'), 'SSO return address is not allowed.')
        }
        assert.equal(fetchCalled, false)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('SSO callback returns to the approved app and consumes the shared Identity binding', async () => {
    const originalFetch = globalThis.fetch
    let callbackBody: Record<string, unknown> | undefined
    globalThis.fetch = async (_input, init) => {
        callbackBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
        return Response.json({ token: 'session-token', id: 'user-1', name: 'Analyst', expires_at: '2030-01-01T00:00:00.000Z', redirectPath: '/dashboard' })
    }

    try {
        const request = new NextRequest('https://hanasand.com/api/auth/sso/callback?code=auth-code&state=auth-state', {
            headers: { cookie: 'hanasand_auth_binding=browser-binding; __Host-sso-return-to=https%3A%2F%2Fcdn.hanasand.com%2F' },
        })
        const response = await callbackSso(request)

        assert.equal(response.headers.get('location'), 'https://cdn.hanasand.com/')
        assert.deepEqual(callbackBody, { code: 'auth-code', state: 'auth-state', binding: 'browser-binding' })
        assert.equal(response.cookies.get('__Host-sso-return-to')?.value, '')
    } finally {
        globalThis.fetch = originalFetch
    }
})
