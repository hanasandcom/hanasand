import assert from 'node:assert/strict'
import { requestExposureQueue } from '../src/app/requestExposureQueue'

const params = new URLSearchParams({ limit: '50', offset: '10', q: 'Acme' })
let requestedUrl = ''
let requestCache = ''
const queue = await requestExposureQueue(params, async (input, init) => {
    requestedUrl = String(input)
    requestCache = init?.cache || ''
    return new Response(JSON.stringify({ status: 'checking', items: [{ id: '1', actor: 'Actor', company: 'Acme' }] }), { status: 202 })
})

assert.equal(requestedUrl, '/api/public/exposure-queue?limit=50&offset=10&q=Acme')
assert.equal(requestCache, 'default')
assert.equal(queue.status, 'checking')
assert.equal(queue.items[0]?.company, 'Acme')

await assert.rejects(
    requestExposureQueue(new URLSearchParams(), async () => new Response('{}', { status: 503 })),
    { message: 'activity-status:503' },
)
