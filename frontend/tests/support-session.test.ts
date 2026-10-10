import { expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { GET } from '../src/app/api/support/session/route'

const sessionCookieName = 'hanasand_support_session'
const renderCookieName = 'hanasand_support_render_session'

test('anonymous support sessions use secure HttpOnly cookies and reuse valid sessions', async () => {
    const request = new NextRequest('https://hanasand.com/api/support/session')
    const first = await GET(request)
    const session = first.cookies.get(sessionCookieName)?.value

    expect(first.status).toBe(204)
    expect(first.headers.get('cache-control')).toBe('no-store')
    expect(await first.text()).toBe('')
    expect(session).toMatch(/^[a-f0-9]{64}$/)

    const cookies = first.headers.get('set-cookie') || ''
    expect(cookies).toContain('HttpOnly')
    expect(cookies).toContain('Secure')
    expect(cookies).toContain('SameSite=Lax')
    expect(cookies).toContain('Domain=.hanasand.com')
    expect(cookies).toContain('Path=/api/support')
    expect(cookies).toContain('Path=/support')

    const second = await GET(new NextRequest('https://hanasand.com/api/support/session', {
        headers: { cookie: `${sessionCookieName}=${session}` },
    }))
    expect(second.cookies.get(sessionCookieName)?.value).toBe(session)
    expect(second.cookies.get(renderCookieName)?.value).toBe(session)
})

test('malformed support sessions are replaced with a fresh token', async () => {
    const response = await GET(new NextRequest('https://hanasand.com/api/support/session', {
        headers: { cookie: `${sessionCookieName}=invalid` },
    }))

    expect(response.cookies.get(sessionCookieName)?.value).toMatch(/^[a-f0-9]{64}$/)
    expect(response.cookies.get(sessionCookieName)?.value).not.toBe('invalid')
})
