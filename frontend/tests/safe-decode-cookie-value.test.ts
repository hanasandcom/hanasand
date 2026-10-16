import { expect, test } from 'bun:test'
import { safeDecodeCookieValue } from '../src/utils/cookies/safeDecodeCookieValue'

test('decodes valid cookie values and preserves malformed or empty values', () => {
    expect(safeDecodeCookieValue('token%2Bvalue%3D')).toBe('token+value=')
    expect(safeDecodeCookieValue('%E0%A4%A')).toBe('%E0%A4%A')
    expect(safeDecodeCookieValue('')).toBe('')
})
