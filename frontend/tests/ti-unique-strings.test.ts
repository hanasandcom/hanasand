import { expect, test } from 'bun:test'
import { uniqueTrimmedStrings } from '../src/utils/ti/stringValues'
import { unique as actorIntelligenceUnique } from '../src/utils/ti/actorIntelligenceValues'
import { unique as actorArtifactUnique } from '../src/utils/ti/actorArtifactUtils'
import { unique as tiModelUnique } from '../src/app/ti/model/evidenceValues'

test('TI consumers share stable trim-and-case-insensitive string deduplication', () => {
    const values = [' Alpha ', 'alpha', 'BETA', 'beta ', '', '   ', 'A  B', 'a b']
    const expected = ['Alpha', 'BETA', 'A  B', 'a b']

    expect(uniqueTrimmedStrings(values)).toEqual(expected)
    expect(actorIntelligenceUnique).toBe(uniqueTrimmedStrings)
    expect(actorArtifactUnique).toBe(uniqueTrimmedStrings)
    expect(tiModelUnique).toBe(uniqueTrimmedStrings)
    expect(actorIntelligenceUnique(values)).toEqual(expected)
    expect(actorArtifactUnique(values)).toEqual(expected)
    expect(tiModelUnique(values)).toEqual(expected)
})

test('TI deduplication retains the prior runtime failure for non-string entries', () => {
    expect(() => uniqueTrimmedStrings([null] as unknown as string[])).toThrow()
})
