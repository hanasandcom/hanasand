import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { watchlistMutationDenialContext } from '../src/handlers/organizations/watchlists/denialContext.ts'

test('denial context prefers camelCase request ID over snake_case', () => {
    assert.deepEqual(watchlistMutationDenialContext({ requestId: 'camel-id', request_id: 'snake-id' }), {
        requestId: 'camel-id', reason: null,
    })
    assert.equal(watchlistMutationDenialContext({ request_id: 'snake-id' }).requestId, 'snake-id')
    assert.equal(watchlistMutationDenialContext({ request_id: 'body-id' }, { requestId: 'query-id' }).requestId, 'body-id')
})

test('archive denial context falls back from body to query request ID aliases', () => {
    assert.equal(watchlistMutationDenialContext({}, { requestId: 'query-camel', request_id: 'query-snake' }).requestId, 'query-camel')
    assert.equal(watchlistMutationDenialContext({}, { request_id: 'query-snake' }).requestId, 'query-snake')
})

test('denial context ignores non-string reasons', () => {
    assert.equal(watchlistMutationDenialContext({ reason: 42 }).reason, null)
})

test('denial context trims and truncates reasons at 1000 characters', () => {
    const reason = `  ${'x'.repeat(1001)}  `
    const context = watchlistMutationDenialContext({ reason })

    assert.equal(context.reason?.length, 1000)
    assert.equal(context.reason, 'x'.repeat(1000))
})
