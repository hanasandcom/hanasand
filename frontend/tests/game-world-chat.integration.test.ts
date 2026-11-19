import { strict as assert } from 'node:assert'
import { test, mock } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'

const identityId = crypto.randomUUID()
// Exercise the real Studio routes against a disposable game API. Authentication
// is replaced so this test never needs a production Identity session.
mock.module('@/utils/proxy/requireApiSession', () => ({
    default: async (request: NextRequest) => request.headers.get('x-test-signed-in') === '1'
        ? { identity: { id: identityId, token: 'private-test', canEditInternalPages: false } }
        : { response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) },
}))

const base = process.env.GAME_CHAT_TEST_SERVER
const run = base ? test : test.skip

run('Studio and native game exchange chat and link the same account', async () => {
    assert.ok(base?.startsWith('http://127.0.0.1:'))
    const priorBase = process.env.GAME_SERVER_INTERNAL_URL
    const priorSecret = process.env.GAME_LINK_SECRET
    process.env.GAME_SERVER_INTERNAL_URL = base
    process.env.GAME_LINK_SECRET = 'private-test'
    try {
        const { GET, POST } = await import('../src/app/api/game-chat/route')
        const { POST: link } = await import('../src/app/api/game-link/route')
        const request = (path: string, signedIn: boolean, body?: unknown, origin = 'https://hanasand.com') =>
            new NextRequest(`https://hanasand.com${path}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { origin, 'content-type': 'application/json', 'x-test-signed-in': signedIn ? '1' : '0' },
                body: body === undefined ? undefined : JSON.stringify(body),
            })
        const game = async (path: string, body?: unknown, token?: string) => {
            const response = await fetch(`${base}${path}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { 'content-type': 'application/json', ...(token ? { 'x-game-session': token } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body),
            })
            const text = await response.text()
            return { status: response.status, body: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text }
        }

        const guest = await GET(request('/api/game-chat?after=0', false))
        assert.equal(guest.status, 200)
        assert.equal(guest.headers.get('x-game-chat-can-send'), '0')
        const existing = await guest.json() as Array<{ id: number }>
        const after = existing.at(-1)?.id || 0
        assert.equal((await POST(request('/api/game-chat', false, { message: 'blocked' }))).status, 401)
        assert.equal((await POST(request('/api/game-chat', true, { message: 'blocked' }, 'https://other.example'))).status, 403)

        const sent = await POST(request('/api/game-chat', true, { message: 'Private Studio message' }))
        assert.equal(sent.status, 201)
        const fromStudio = await GET(request(`/api/game-chat?after=${after}`, false))
        assert.equal(fromStudio.headers.get('x-game-chat-can-send'), '0')
        const firstMessages = await fromStudio.json() as Array<{ id: number; body: string }>
        assert.equal(firstMessages.length, 1)
        assert.equal(firstMessages[0].body, 'Private Studio message')

        const clientKey = crypto.randomUUID()
        const playerName = `Private-${clientKey.slice(0, 8)}`
        const joined = await game('/world/join', { name: playerName, client_key: clientKey })
        assert.equal(joined.status, 200)
        const player = joined.body as { player_id: string; session_token: string }
        const nativeRead = await game(`/chat?player_id=${player.player_id}&after=0`, undefined, player.session_token)
        assert.equal(nativeRead.status, 200)
        assert.ok(nativeRead.body.some((message: { body: string }) => message.body === 'Private Studio message'))
        const nativeSend = await fetch(`${base}/chat`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-game-session': player.session_token },
            body: JSON.stringify({ player_id: player.player_id, body: 'Private game message' }),
        })
        assert.equal(nativeSend.status, 201)
        const snapshot = 'HANASAND_NATIVE_SAVE_2\nprivate-progress'
        const saved = await fetch(`${base}/progress`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-game-session': player.session_token },
            body: JSON.stringify({ player_id: player.player_id, snapshot }),
        })
        assert.equal(saved.status, 204)
        const fromGame = await GET(request(`/api/game-chat?after=${firstMessages[0].id}`, true))
        assert.equal(fromGame.headers.get('x-game-chat-can-send'), '1')
        assert.equal((await fromGame.json())[0].body, 'Private game message')

        const started = await fetch(`${base}/link/start`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-game-session': player.session_token },
            body: JSON.stringify({ player_id: player.player_id }),
        })
        assert.equal(started.status, 200)
        const { code } = await started.json() as { code: string }
        assert.equal((await link(request('/api/game-link', true, { code }, 'https://other.example'))).status, 403)
        assert.equal((await link(request('/api/game-link', true, { code }))).status, 200)
        const linked = await game(`/link/status?code=${code}`, undefined, player.session_token)
        assert.equal(linked.status, 200)
        assert.ok(linked.body.session_token)
        const resumed = await game('/world/join', { name: playerName, client_key: clientKey })
        assert.equal(resumed.status, 200)
        assert.equal(resumed.body.player_id, linked.body.linked_player_id)
        assert.equal(resumed.body.linked, true)
        const progress = await game(`/progress?player_id=${resumed.body.player_id}`, undefined, resumed.body.session_token)
        assert.equal(progress.status, 200)
        assert.equal(progress.body, snapshot)
    } finally {
        if (priorBase === undefined) delete process.env.GAME_SERVER_INTERNAL_URL
        else process.env.GAME_SERVER_INTERNAL_URL = priorBase
        if (priorSecret === undefined) delete process.env.GAME_LINK_SECRET
        else process.env.GAME_LINK_SECRET = priorSecret
    }
})
