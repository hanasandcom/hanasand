import { NextRequest, NextResponse } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import requireApiSession from '@/utils/proxy/requireApiSession'

export async function proxyApiTiRequest(request: NextRequest, path: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', timeoutMs?: number } = {}) {
    const apiKey = presentedApiKey(request)
    const session = apiKey ? undefined : await requireApiSession(request)
    if (session && 'response' in session) {
        return NextResponse.json({ error: 'authentication_required', message: 'A valid API key or Hanasand session is required.' }, { status: 401, headers: { 'cache-control': 'no-store' } })
    }

    try {
        const target = new URL(`${authApiUrl().replace(/\/$/, '')}${path}`)
        const method = options.method || request.method as 'GET' | 'POST'
        const response = await fetch(target, {
            method,
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                ...(apiKey ? { 'x-api-key': apiKey } : {
                    Authorization: `Bearer ${session!.identity.token}`,
                    id: session!.identity.id,
                }),
            },
            ...(method === 'GET' ? {} : { body: await request.text() }),
            signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
        })
        const text = await response.text()
        const headers = new Headers({
            'cache-control': 'no-store',
            'content-type': response.headers.get('content-type') || 'application/json',
        })
        for (const [name, value] of response.headers) {
            if (name === 'retry-after' || name.startsWith('x-rate-limit-') || name.startsWith('x-api-key-rate-limit-')) headers.set(name, value)
        }
        return new NextResponse(text, { status: response.status, headers })
    } catch {
        return NextResponse.json({ error: 'ti_proxy_failed', message: 'Threat-intelligence API is temporarily unavailable.' }, { status: 502, headers: { 'cache-control': 'no-store' } })
    }
}

export function presentedApiKey(request: Pick<NextRequest, 'headers'>) {
    const header = request.headers.get('x-api-key')?.trim() || ''
    if (header) return header
    const authorization = request.headers.get('authorization') || ''
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    return bearer.startsWith('hsk_') ? bearer : ''
}
