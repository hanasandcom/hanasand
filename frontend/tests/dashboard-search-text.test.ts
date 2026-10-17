// @ts-expect-error Bun provides this module when running focused tests.
import { describe, expect, test } from 'bun:test'
import { matchesSearchQuery } from '../src/app/dashboard/searchText'

describe('dashboard search text', () => {
    test('matches case-insensitively without trimming the query', () => {
        expect(matchesSearchQuery('Critical Finding', 'finding')).toBe(true)
        expect(matchesSearchQuery('Critical Finding', ' Finding')).toBe(true)
        expect(matchesSearchQuery('Critical Finding', ' finding ')).toBe(false)
    })

    test('an empty query matches present text', () => {
        expect(matchesSearchQuery('anything', '')).toBe(true)
        expect(matchesSearchQuery('', '')).toBe(true)
    })

    test('missing values do not match', () => {
        expect(matchesSearchQuery(undefined, '')).toBe(false)
        expect(matchesSearchQuery(null, 'finding')).toBe(false)
    })
})
