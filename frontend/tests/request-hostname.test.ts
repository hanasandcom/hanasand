import { expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { authCookieOptions, requestHostname } from '../src/utils/proxy/authResponses'

test('request hostname prefers the first forwarded host and strips its port', () => {
    const request = new NextRequest('http://internal.test/api/auth/login', {
        headers: {
            host: 'internal.test',
            'x-forwarded-host': 'app.hanasand.com:443, internal.test',
        },
    })

    expect(requestHostname(request)).toBe('app.hanasand.com')
    expect(authCookieOptions(request)).toMatchObject({
        secure: true,
        sharedDomain: '.hanasand.com',
    })
})

test('request hostname falls back to host before the request URL hostname', () => {
    const request = new NextRequest('http://url-host.test/api/auth/login', {
        headers: { host: 'header-host.test:3000' },
    })

    expect(requestHostname(request)).toBe('header-host.test')
})

test('request hostname falls back to the request URL hostname', () => {
    const request = new NextRequest('http://url-host.test/api/auth/login')

    expect(request.headers.get('host')).toBeNull()
    expect(requestHostname(request)).toBe('url-host.test')
    expect(authCookieOptions(request)).toMatchObject({
        secure: false,
        sharedDomain: null,
    })
})
