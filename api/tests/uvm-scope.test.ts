import { describe, expect, test } from 'bun:test'
import { normalizeUvmHostname, parseAuthorizedAddresses, sameAuthorizedAddressSet } from '../src/utils/vulnerabilities/uvmScope.ts'

describe('UVM asset scope', () => {
    test('normalizes public hostnames and rejects URL, literal IP, and local scope', () => {
        expect(normalizeUvmHostname('  Example.COM. ')).toBe('example.com')
        for (const invalid of ['https://example.com', '8.8.8.8', 'localhost', 'service.local', 'example.com:443']) {
            expect(() => normalizeUvmHostname(invalid)).toThrow()
        }
    })

    test('requires the current resolved IP set to match stored authorization', () => {
        expect(sameAuthorizedAddressSet(['8.8.8.8', '1.1.1.1'], ['1.1.1.1', '8.8.8.8'])).toBe(true)
        expect(sameAuthorizedAddressSet(['8.8.8.8'], ['8.8.8.8', '1.1.1.1'])).toBe(false)
        expect(sameAuthorizedAddressSet([], ['8.8.8.8'])).toBe(false)
        expect(parseAuthorizedAddresses('["8.8.8.8","1.1.1.1"]')).toEqual(['1.1.1.1', '8.8.8.8'])
    })
})
