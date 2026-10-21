import { isIP } from 'node:net'

// The public proxy overwrites X-Real-IP. Never forward a client-supplied chain.
export function clientHeaders(request: { headers: Headers, url: string, method: string }): Record<string, string> {
    const headers = request.headers
    const ip = (headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',').at(-1) || '').trim()
    const requestUrl = new URL(request.url)
    const forwardedHost = headers.get('x-forwarded-host') || headers.get('host') || requestUrl.host
    const forwardedProto = headers.get('x-forwarded-proto') || requestUrl.protocol.slice(0, -1)
    return {
        'user-agent': (headers.get('user-agent') || '').slice(0, 1000),
        ...(isIP(ip) ? { 'x-forwarded-for': ip } : {}),
        ...(headers.get('x-device-public-jwk') ? { 'x-device-public-jwk': headers.get('x-device-public-jwk')! } : {}),
        ...(headers.get('dpop') ? { DPoP: headers.get('dpop')! } : {}),
        'x-device-proof-url': `${forwardedProto}://${forwardedHost}${requestUrl.pathname}`,
        'x-device-proof-method': request.method,
    }
}
