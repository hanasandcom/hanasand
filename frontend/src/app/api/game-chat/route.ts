import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'

export const dynamic = 'force-dynamic'

async function gameSession(request: NextRequest) {
    const session = await requireApiSession(request)
    if ('response' in session) return { error: session.response }
    const base = process.env.GAME_SERVER_INTERNAL_URL
    const secret = process.env.GAME_LINK_SECRET
    if (!base || !secret) return { error: NextResponse.json({ error: 'Game chat is unavailable.' }, { status: 503 }) }
    try {
        const response = await fetch(`${base.replace(/\/$/, '')}/world/join`, {
            method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(4000),
            headers: { 'content-type': 'application/json', 'x-game-link-secret': secret },
            body: JSON.stringify({ name: `Hanasand-${session.identity.id.slice(0, 12)}`, hanasand_user_id: session.identity.id }),
        })
        if (!response.ok) throw new Error('join failed')
        const player = await response.json() as { player_id: string }
        return { base: base.replace(/\/$/, ''), playerId: player.player_id, secret }
    } catch { return { error: NextResponse.json({ error: 'Game chat is unavailable.' }, { status: 503 }) } }
}

export async function GET(request: NextRequest) {
    const linked = await gameSession(request)
    if ('error' in linked) return linked.error
    const after = Number(request.nextUrl.searchParams.get('after') || 0)
    if (!Number.isSafeInteger(after) || after < 0) return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
    try {
        const response = await fetch(`${linked.base}/chat?player_id=${linked.playerId}&after=${after}`, { cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { 'x-game-link-secret': linked.secret } })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'cache-control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Game chat is unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: 'Cross-site messages are not allowed.' }, { status: 403 })
    const linked = await gameSession(request)
    if ('error' in linked) return linked.error
    let body: { message?: unknown }
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid message.' }, { status: 400 }) }
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 500) return NextResponse.json({ error: 'Message must be 1–500 characters.' }, { status: 400 })
    try {
        const response = await fetch(`${linked.base}/chat`, { method: 'POST', signal: AbortSignal.timeout(4000), headers: { 'content-type': 'application/json', 'x-game-link-secret': linked.secret }, body: JSON.stringify({ player_id: linked.playerId, body: body.message.trim() }) })
        return new NextResponse(null, { status: response.status })
    } catch { return NextResponse.json({ error: 'Game chat is unavailable.' }, { status: 503 }) }
}
