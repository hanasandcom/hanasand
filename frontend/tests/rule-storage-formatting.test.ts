import { describe, expect, test } from 'bun:test'
import { formatRuleStorageBytes } from '../src/app/dashboard/rules/ruleStorageFormatting'

describe('rule storage byte formatting', () => {
    test('keeps the tuning page spacing and rounding', () => {
        expect(formatRuleStorageBytes(512)).toBe('512 B')
        expect(formatRuleStorageBytes(1024)).toBe('1.0 KB')
        expect(formatRuleStorageBytes(15 * 1024)).toBe('15 KB')
    })

    test('supports the compact displays used by rule details and reprocessing', () => {
        expect(formatRuleStorageBytes(512, { byteUnit: '', scaledUnit: '' })).toBe('512B')
        expect(formatRuleStorageBytes(15 * 1024, { byteUnit: '', scaledUnit: '' })).toBe('15KB')
        expect(formatRuleStorageBytes(512, { scaledUnit: '' })).toBe('512 B')
        expect(formatRuleStorageBytes(15 * 1024, { scaledUnit: '' })).toBe('15KB')
    })
})
