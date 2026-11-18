import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: 'Cross-site account links are not allowed.' }, { status: 403 })
    const session = await requireApiSession(request)
    if ('response' in session) return session.response
    let body: { code?: unknown }
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid link code.' }, { status: 400 }) }
    if (typeof body.code !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.code)) return NextResponse.json({ error: 'Invalid link code.' }, { status: 400 })
    const base = process.env.GAME_SERVER_INTERNAL_URL
    const secret = process.env.GAME_LINK_SECRET
    if (!base || !secret) return NextResponse.json({ error: 'Game linking is unavailable.' }, { status: 503 })
    try {
        const response = await fetch(`${base.replace(/\/$/, '')}/link/complete`, {
            method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
            headers: { 'content-type': 'application/json', 'x-game-link-secret': secret },
            body: JSON.stringify({ code: body.code, hanasand_user_id: session.identity.id }),
        })
        if (!response.ok) return NextResponse.json({ error: response.status === 404 ? 'This link has expired. Request a new one in the game.' : 'Could not link the game account.' }, { status: response.status })
        return NextResponse.json({ linked: true }, { headers: { 'cache-control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Game linking is unavailable.' }, { status: 503 }) }
}
