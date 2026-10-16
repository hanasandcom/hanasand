import assert from 'node:assert/strict'
import { test } from 'node:test'
import { serveDwmProductSnapshot } from '../src/app/api/findings/dwmProductSnapshotCache'

test('returns a successful product snapshot from cache within the freshness window', async () => {
    const previousFetch = globalThis.fetch
    let fetches = 0
    globalThis.fetch = async () => {
        fetches += 1
        return Response.json({ snapshot: 'cached' }, { status: 206 })
    }

    try {
        const target = new URL(`https://ti.example/v1/dwm/product?test=${crypto.randomUUID()}`)
        const first = await serveDwmProductSnapshot(target, { method: 'GET' })
        const second = await serveDwmProductSnapshot(target, { method: 'GET' })
        assert.equal(first.status, 206)
        assert.equal(second.status, 200)
        assert.deepEqual(await first.json(), { snapshot: 'cached' })
        assert.deepEqual(await second.json(), { snapshot: 'cached' })
        assert.equal(first.headers.get('cache-control'), 'no-store')
        assert.equal(fetches, 1)
    } finally {
        globalThis.fetch = previousFetch
    }
})
