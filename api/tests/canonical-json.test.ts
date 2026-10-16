import { expect, test } from 'bun:test'
import { matchesCanonicalJson } from '../src/utils/events/canonicalJson.ts'

test('matches only compact JSON whose parsed value is structurally identical', () => {
    const record = { level: 30, message: 'http_access' }
    expect(matchesCanonicalJson('{"level":30,"message":"http_access"}', record)).toBe(true)
    expect(matchesCanonicalJson('{"level":30, "message":"http_access"}', record)).toBe(false)
    expect(matchesCanonicalJson('{"level":30,"message":"other"}', record)).toBe(false)
})

test('rejects duplicate keys and malformed JSON instead of trusting the parsed value', () => {
    const record = { level: 30, message: 'http_access' }
    expect(matchesCanonicalJson('{"level":50,"level":30,"message":"http_access"}', record)).toBe(false)
    expect(matchesCanonicalJson('{invalid json', record)).toBe(false)
})
