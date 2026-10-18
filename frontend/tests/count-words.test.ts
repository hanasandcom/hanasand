// @ts-expect-error Bun provides the test module for focused checks.
import { expect, test } from 'bun:test'
import countWords from '../src/utils/text/countWords'

test('counts trimmed whitespace-separated words', () => {
    expect(countWords('')).toBe(0)
    expect(countWords(' \n\t ')).toBe(0)
    expect(countWords(' one   two\nthree ')).toBe(3)
})
