import assert from 'node:assert/strict'
import test from 'node:test'
import { isRecord } from '../src/utils/isRecord'

test('isRecord accepts object values and rejects null, arrays, and primitives', () => {
    assert.equal(isRecord({ key: 'value' }), true)
    assert.equal(isRecord(null), false)
    assert.equal(isRecord([]), false)
    assert.equal(isRecord('value'), false)
})
