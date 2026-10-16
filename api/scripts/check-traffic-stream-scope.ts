import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mock } from 'bun:test'
let checked = false
const trafficRows = [{ iso: 'NO', count: 2, max_id: '42', timestamp: '2026-10-16T12:00:00.000Z' }]
mock.module('#db', () => ({
    queryOnce: async (sql: string, params: unknown[]) => {
        assert.match(sql, /domain = \$3/)
        assert.match(sql, /ORDER BY id ASC/)
        assert.equal(params[0], 42)
        assert.equal(params[2], 'selected.test')
        checked = true
        return { rows: trafficRows }
    },
    withTransaction: () => { throw new Error('Live streams should read directly') },
}))
const { getLegacyTrafficLive } = await import('../src/handlers/traffic/legacy.ts')
const writes: string[] = []
const raw = Object.assign(new EventEmitter(), { writeHead: () => {}, write: (chunk: string) => writes.push(chunk) })
await getLegacyTrafficLive({ query: { domain: 'selected.test', after: '42' } } as never, { hijack: () => {}, raw } as never)
await new Promise(resolve => setTimeout(resolve, 0))
raw.emit('close')
assert(checked)
const stream = writes.join('')
assert(stream.includes('event: ready\ndata: {"status":"connected"}\n\n'))
assert(stream.includes(`event: traffic\ndata: ${JSON.stringify(trafficRows)}\n\n`))
console.log('PASS: stream queries use the selected domain and resume cursor in record order, then emit the expected SSE frames.')
