// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { finiteNumber, quotaValue } from '../src/app/sandbox/_browser/browser/browserValues'

test('preserves unlimited signed-in quota values from the Browser API', () => {
    const quota = quotaValue({
        plan: 'free',
        paid: false,
        advancedAnalysis: false,
        sessionSeconds: 90,
        concurrentLimit: null,
        active: 0,
        limit: null,
        used: 0,
        remaining: null,
        identityKind: 'user',
    })

    expect(quota?.identityKind).toBe('user')
    expect(quota?.concurrentLimit).toBeNull()
    expect(quota?.limit).toBeNull()
    expect(quota?.remaining).toBeNull()
    expect(quota?.used).toBe(0)
})

test('parses explicit zero but ignores empty, missing, null, and malformed numbers', () => {
    expect(finiteNumber(0)).toBe(0)
    expect(finiteNumber('0')).toBe(0)
    expect(finiteNumber(null)).toBeNull()
    expect(finiteNumber(undefined)).toBeNull()
    expect(finiteNumber('')).toBeNull()
    expect(finiteNumber('not-a-number')).toBeNull()
    expect(finiteNumber(false)).toBeNull()
})
