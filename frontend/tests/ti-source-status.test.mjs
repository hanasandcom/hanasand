import assert from 'node:assert/strict'
import { mock, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'

mock.module('@/utils/proxy/requireApiSession', () => ({
    default: async () => ({ response: NextResponse.json({ error: 'Session required.' }, { status: 401 }) }),
}))

const { GET, POST } = await import('../src/app/api/ti/scraper/control/route')
const request = (method) => new NextRequest('http://frontend.test/api/ti/scraper/control', { method })

test('TI scraper control requires an authenticated session', async () => {
    assert.equal((await GET(request('GET'))).status, 401)
    assert.equal((await POST(request('POST'))).status, 401)
})
