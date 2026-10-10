import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

const cookieName = 'hanasand_support_session'
const renderCookieName = 'hanasand_support_render_session'

export async function GET(request: NextRequest) {
    const existing = request.cookies.get(cookieName)?.value
    const session = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex')
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    const hostname = requestHostname(request)
    const isHanasandHost = hostname === 'hanasand.com' || hostname.endsWith('.hanasand.com')
    const sharedDomain = isHanasandHost ? { domain: '.hanasand.com' } : {}
    const secure = request.nextUrl.protocol === 'https:' || isHanasandHost
    const common = { httpOnly: true, secure, sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30 }
    response.cookies.set(cookieName, session, { ...common, ...sharedDomain, path: '/api/support' })
    response.cookies.set(renderCookieName, session, { ...common, path: '/support' })
    return response
}

function requestHostname(request: NextRequest) {
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || request.headers.get('host') || request.nextUrl.hostname
    return host.split(':')[0].toLowerCase()
}
