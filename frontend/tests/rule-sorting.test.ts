import { expect, test } from 'bun:test'
import { compareRules, getRuleActionLabel, getRuleSourceLabel } from '../src/app/dashboard/rules/rule-sort'
import type { Rule } from '../src/app/dashboard/rules/detection-rules'

const rule = (id: string, source: Rule['source'], action?: 'drop' | 'keep'): Rule => ({
    id, name: id, version: '1', family: 'test', severity: 'low', explanation: '', evidence: [], source,
    definition: action ? { action } : undefined,
})

test('rule source labels preserve known labels and each caller fallback', () => {
    expect(['owned', 'open_source', 'hanasand'].map(source => getRuleSourceLabel(rule('rule', source as Rule['source']))))
        .toEqual(['Custom rule', 'Imported rule', 'Hanasand rule'])
    expect(getRuleSourceLabel(rule('rule', undefined))).toBe('Hanasand rule')
    expect(getRuleSourceLabel(rule('rule', undefined), { unknownSource: 'custom' })).toBe('Custom rule')
    expect(getRuleSourceLabel(rule('rule', 'future' as Rule['source']))).toBe('Hanasand rule')
    expect(getRuleSourceLabel(rule('rule', 'future' as Rule['source']), { unknownSource: 'custom' })).toBe('Custom rule')
})

test('rule action label is shared with action sorting and defaults to Store', () => {
    const drop = rule('drop', 'owned', 'drop')
    const store = rule('store', 'owned')
    expect(getRuleActionLabel(drop)).toBe('Drop')
    expect(getRuleActionLabel(store)).toBe('Store')
    expect(compareRules(drop, store, 'Action', 'ascending')).toBeLessThan(0)
})
