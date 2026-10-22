import { NextRequest, NextResponse } from 'next/server'

const ssoReturnHosts = new Set(['hanasand.com', 'www.hanasand.com', 'mail.hanasand.com', 'cdn.hanasand.com'])

export function safeSsoReturnTo(value: unknown) {
    if (typeof value !== 'string' || value.length > 2048) return null
    try {
        const target = new URL(value)
        if (target.protocol !== 'https:' || target.port || target.username || target.password || target.hash || !ssoReturnHosts.has(target.hostname)) return null
        return target.toString()
    } catch {
        return null
    }
}

export function loginRedirect(req: NextRequest, error: string) {
    const target = publicUrl(req, '/login')
    target.searchParams.set('error', error)
    return NextResponse.redirect(target)
}

export function publicUrl(req: NextRequest, path: string) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.host
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const protocol = forwardedProto || (host.endsWith('hanasand.com') ? 'https' : req.nextUrl.protocol.replace(':', ''))
    if (isInternalHost(host) && process.env.NODE_ENV === 'production') return new URL(path, 'https://hanasand.com')
    return new URL(path, `${protocol}://${host}`)
}

function isInternalHost(host: string) {
    const hostname = host.split(':')[0]
    return hostname === '0.0.0.0' || hostname === 'api' || hostname === 'frontend'
}
