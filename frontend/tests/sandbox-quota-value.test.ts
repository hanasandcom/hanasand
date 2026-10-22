import assert from 'node:assert/strict'
import test from 'node:test'
import { quotaValue } from '../src/app/sandbox/_browser/browser/browserValues'

test('signed-in Browser quota preserves unlimited values', () => {
    assert.deepEqual(quotaValue({
        plan: 'free',
        paid: false,
        sessionSeconds: 90,
        concurrentLimit: null,
        active: 0,
        limit: null,
        used: 60,
        remaining: null,
        identityKind: 'user',
    }), {
        plan: 'free',
        paid: false,
        advancedAnalysis: false,
        sessionSeconds: 90,
        concurrentLimit: null,
        active: 0,
        limit: null,
        used: 60,
        remaining: null,
        resetsAt: null,
        identityKind: 'user',
    })
})
