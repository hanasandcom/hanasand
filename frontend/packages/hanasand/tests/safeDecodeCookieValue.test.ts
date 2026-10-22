import { expect, test } from 'bun:test'
import { safeDecodeCookieValue } from '../src/cookies'

test('decodes valid URI cookie values', () => {
    expect(safeDecodeCookieValue('token%2Bvalue%3D')).toBe('token+value=')
})

test('preserves malformed URI cookie values', () => {
    expect(safeDecodeCookieValue('%E0%A4%A')).toBe('%E0%A4%A')
})
