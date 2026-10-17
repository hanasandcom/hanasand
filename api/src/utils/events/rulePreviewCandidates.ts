import { exactCaseSensitiveMessage, exactMessageIndexMaxBytes, finiteRegexAlternatives, previewPredicate, processExecutableCandidatePredicate } from './previewPredicate.ts'
import type { Condition } from './conditions.ts'
import { logFieldTextCandidates } from '../logs/searchText.ts'

export function storageEstimatePredicate(conditions: Condition[], params: (string | string[] | number | boolean | null)[]) {
    const predicates = [previewPredicate(conditions, params)]
    // For a case-sensitive exact message selector, use the matching ordered
    // B-tree candidate instead of combining broad trigram/executable bitmaps.
    // This lets PostgreSQL seek directly to the message and return its newest
    // rows without sorting a large match set. JS still decides exact matches.
    const exactMessage = exactCaseSensitiveMessage(conditions)
    if (exactMessage) {
        params.push(exactMessage.value)
        predicates.push(`normalized->>'message' = $${params.length} AND octet_length(normalized->>'message') <= ${exactMessageIndexMaxBytes}`)
    } else {
        const executable = processExecutableCandidatePredicate(conditions, value => { params.push(value); return `$${params.length}` })
        if (executable) predicates.push(executable)
    }
    // The existing GIN index covers processed logs. One safe, selective literal
    // from this conjunction is enough to exclude non-candidates before paging.
    // The residual predicate and JS matcher still determine exact membership.
    const groups = conditions.flatMap(condition => {
        const values = condition.operator === 'regex' ? finiteRegexAlternatives(condition.value) : [condition.value]
        if (!values || values.some(value => value.length < 3 || !/^[\x20-\x7E]+$/.test(value)
            || (value.match(/[A-Za-z0-9]/g)?.length || 0) < 3)) return []
        return [{ values, shortest: Math.min(...values.map(value => value.length)) }]
    }).sort((left, right) => right.shortest - left.shortest || right.values.reduce((sum, value) => sum + value.length, 0)
        - left.values.reduce((sum, value) => sum + value.length, 0))
    if (groups[0] && !exactMessage) {
        const alternatives = groups[0].values.map(value => {
            params.push(value)
            return logFieldTextCandidates(`$${params.length}`)
        })
        predicates.push(alternatives.length === 1 ? alternatives[0] : `(${alternatives.join(' OR ')})`)
    }
    return predicates.filter(predicate => predicate !== 'TRUE').map(predicate => `(${predicate})`).join(' AND ') || 'TRUE'
}
