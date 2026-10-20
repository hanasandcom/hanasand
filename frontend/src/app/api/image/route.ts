import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import tokenIsValid from '@/utils/proxy/tokenIsValid'
import isPublicIpv4 from '@/utils/proxy/isPublicIpv4'

export const runtime = 'nodejs'

const MAX_PROXY_BYTES = 20 * 1024 * 1024
const MAX_REDIRECTS = 3
const MEDIA_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm', 'video/ogg',
])
export async function GET(req: Request) {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value || ''
    const token = cookieStore.get('access_token')?.value || ''
    if (!id || !token) return NextResponse.json({ error: 'Sign in to upload files.' }, { status: 401 })
    const session = await tokenIsValid(token, id, undefined, { includeInternalAccess: false })
    if (!session.valid) {
        const status = session.state === 'unavailable' ? 503 : 401
        return NextResponse.json({ error: status === 401 ? 'Sign in to upload files.' : 'Sign-in service is unavailable.' }, { status })
    }

    const value = new URL(req.url).searchParams.get('url')
    if (!value) return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
    if (value.length > 2048) return NextResponse.json({ error: 'URL is too long.' }, { status: 400 })

    try {
        const result = await fetchPublicMedia(new URL(value))
        return new NextResponse(new Uint8Array(result.body), {
            headers: { 'Content-Type': result.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
        })
    } catch (error) {
        const status = error instanceof ProxyError ? error.status : 400
        return NextResponse.json({ error: error instanceof Error ? error.message : 'URL could not be fetched.' }, { status })
    }
}

class ProxyError extends Error {
    constructor(message: string, readonly status: number) { super(message) }
}

async function fetchPublicMedia(url: URL, redirects = 0): Promise<{ body: Buffer, type: string }> {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
        throw new ProxyError('Use a public HTTP or HTTPS media URL.', 400)
    }
    if (isIP(url.hostname)) {
        if (isIP(url.hostname) !== 4 || !isPublicIpv4(url.hostname)) throw new ProxyError('URL must point to a public media host.', 400)
    }
    const addresses = isIP(url.hostname) ? [{ address: url.hostname, family: 4 }] : await lookup(url.hostname, { all: true, family: 4 })
    const address = addresses.find(item => item.family === 4 && isPublicIpv4(item.address))
    if (!address) throw new ProxyError('URL must point to a public media host.', 400)

    const response = await requestPinned(url, address.address)
    if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
        response.resume()
        const location = response.headers.location
        if (!location || redirects >= MAX_REDIRECTS) throw new ProxyError('Too many redirects.', 400)
        return fetchPublicMedia(new URL(location, url), redirects + 1)
    }
    if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
        response.resume()
        throw new ProxyError('Remote media could not be fetched.', 400)
    }

    const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!MEDIA_TYPES.has(type)) {
        response.resume()
        throw new ProxyError('URL must return a supported image or video.', 400)
    }
    const length = Number(response.headers['content-length'])
    if (Number.isFinite(length) && length > MAX_PROXY_BYTES) {
        response.destroy()
        throw new ProxyError('Media file is too large.', 413)
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of response) {
        const buffer = Buffer.from(chunk)
        size += buffer.length
        if (size > MAX_PROXY_BYTES) {
            response.destroy()
            throw new ProxyError('Media file is too large.', 413)
        }
        chunks.push(buffer)
    }
    if (size === 0) throw new ProxyError('Remote media is empty.', 400)
    return { body: Buffer.concat(chunks, size), type }
}

function requestPinned(url: URL, address: string) {
    return new Promise<import('node:http').IncomingMessage>((resolve, reject) => {
        const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
            lookup: (_hostname, _options, callback) => callback(null, address, 4),
            headers: { Accept: [...MEDIA_TYPES].join(', ') },
        }, resolve)
        request.setTimeout(10_000, () => request.destroy(new Error('Remote media request timed out.')))
        request.on('error', reject)
        request.end()
    })
}
