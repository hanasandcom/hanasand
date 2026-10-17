import type { Condition } from './conditions.ts'
import { executableConditionLiterals, regexCandidate } from './previewRegex.ts'

export { finiteRegexAlternatives, hasIndexedProcessExecutableSelector, hasPostgresRegexCandidate } from './previewRegex.ts'

export const exactMessageIndexMaxBytes = 2048

export function exactCaseSensitiveMessage(conditions: Condition[]) {
    return conditions.find(condition => condition.path === 'message' && condition.operator === 'equals'
        && condition.caseSensitive === true && Buffer.byteLength(condition.value, 'utf8') <= exactMessageIndexMaxBytes)
}

const scalarColumns: Record<string, string> = {
    service: 'normalized->>\'service\'',
    event_type: 'event_type',
    action: 'action',
    outcome: 'outcome',
    'user.id': 'user_id',
    'user.email': 'user_email',
    'source.ip': 'source_ip',
    'source.country': 'source_country',
    'source.city': 'source_city',
    'device.id': 'device_id',
}

function scalarCandidatePredicate(condition: Condition, column: string, bind: (value: string) => string) {
    // Normalized log service has a matching partial B-tree index. The JSON path
    // scalar check already excludes missing/null values, so keep this term
    // sargable for exact service rules instead of wrapping it in a fallback OR.
    if (column === 'normalized->>\'service\'' && condition.operator === 'equals' && condition.caseSensitive)
        return `${column} = ${bind(condition.value)}`
    const ascii = `${column} !~ '[^\\x00-\\x7F]'`
    const prefix = `${column} IS NULL OR NOT (${ascii}) OR `
    const actual = condition.caseSensitive ? column : `lower(${column} COLLATE "C")`
    if (condition.operator === 'equals' || condition.operator === 'contains') {
        const expected = bind(condition.caseSensitive ? condition.value : condition.value.toLowerCase())
        if (condition.operator === 'equals') return `(${prefix}${actual} = ${expected})`
        return `(${prefix}strpos(${actual}, ${expected}) > 0)`
    }
    const expression = regexCandidate(condition.value)
    return expression === null ? null : `(${prefix}${column} COLLATE "C" ~* ${bind(expression)})`
}

// Only narrow raw replay pages when the message comparison is representable in
// PostgreSQL. The full rule still runs on every returned candidate.
export function messageCandidatePredicate(
    conditions: Condition[],
    column: string,
    bind: (value: string) => string,
    options: { useTrigram?: boolean } = {},
) {
    const ascii = `${column} !~ '[^\\x00-\\x7F]'`
    const trigramNeedles = options.useTrigram !== false && column === 'normalized->>\'message\'' ? conditions.flatMap(condition => {
        if (condition.path !== 'message') return []
        const value = condition.operator === 'regex'
            ? /^\^([A-Za-z0-9 _:/@,=-]{3,})/.exec(condition.value)?.[1]
            : condition.value.length >= 3 ? condition.value : null
        if (!value || /[^A-Za-z0-9 _:/@,=-]/.test(value)) return []
        return [`translate(lower(normalized::text), ' ', '0') LIKE ${bind('%' + value.toLowerCase().replaceAll(' ', '0') + '%')}`]
    }) : []
    const predicates = conditions.filter(condition => condition.path === 'message').flatMap(condition => {
        if (condition.operator === 'regex') {
            const pattern = regexCandidate(condition.value)
            return pattern === null ? [] : [`(NOT (${ascii}) OR ${column} COLLATE "C" ${condition.caseSensitive ? '~' : '~*'} ${bind(pattern)})`]
        }
        const expected = bind(condition.caseSensitive ? condition.value : condition.value.toLowerCase())
        const actual = condition.caseSensitive ? column : `lower(${column} COLLATE "C")`
        return [`(NOT (${ascii}) OR ${condition.operator === 'equals' ? `${actual} = ${expected}` : `strpos(${actual}, ${expected}) > 0`})`]
    })
    const all = [...trigramNeedles, ...predicates]
    return all.length ? all.join(' AND ') : 'TRUE'
}

// Candidate only: the indexed suffix narrows executable paths. The full
// condition is still checked by the rule matcher, so suffix collisions are safe.
export function processExecutableCandidatePredicate(conditions: Condition[], bind: (value: string) => string) {
    const expression = 'left(reverse(lower(COALESCE(normalized#>>\'{process,executable}\', \'\'))), 512)'
    const clauses = conditions.flatMap(condition => {
        const values = executableConditionLiterals(condition)
        if (!values) return []
        const alternatives = values.map(value => {
            const reversedPrefix = value.toLowerCase().split('').reverse().join('').slice(0, 512)
            const pattern = reversedPrefix.replace(/[!%_]/g, character => `!${character}`) + '%'
            return `${expression} LIKE ${bind(pattern)} ESCAPE '!'`
        })
        return [`(${alternatives.join(' OR ')})`]
    })
    return clauses.length ? clauses.join(' AND ') : null
}

// These are candidate predicates, not a second rule engine. Keep the runtime
// recheck: JavaScript number formatting and Unicode folding differ from SQL.
export function previewPredicate(conditions: Condition[], params: (string | number | boolean | null | string[])[]) {
    const bind = (value: string | string[]) => { params.push(value); return `$${params.length}` }
    const predicates: string[] = []
    for (const condition of conditions) {
        const parts = condition.path.split('.')
        const path = bind(parts), json = `(normalized #> ${path}::text[])`, text = `(normalized #>> ${path}::text[])`
        predicates.push(`jsonb_typeof(${json}) IN ('string', 'number', 'boolean')`)
        const scalar = scalarColumns[condition.path]
        if (scalar) {
            const scalarPredicate = scalarCandidatePredicate(condition, scalar, bind)
            if (scalarPredicate) predicates.push(scalarPredicate)
        }
        // Array subscripts accepted by #> are not paths accepted by getPath.
        for (let depth = 1; depth < parts.length; depth++) predicates.push(`jsonb_typeof(normalized #> ${bind(parts.slice(0, depth))}::text[]) = 'object'`)
        const ascii = `${text} !~ '[^\\x00-\\x7F]'`
        const unusualNumber = `(jsonb_typeof(${json}) = 'number' AND ${text} !~ '^(0|-?[1-9][0-9]{0,14})$')`
        if (condition.operator === 'equals') {
            const value = bind(condition.value.toLowerCase())
            const number = Number(condition.value)
            const numeric = Number.isFinite(number) && String(number).toLowerCase() === condition.value.toLowerCase()
                ? `${text}::numeric BETWEEN ${bind(String(number))}::numeric - ${bind(String(Math.max(Math.abs(number) * Number.EPSILON, Number.MIN_VALUE)))}::numeric
                    AND ${bind(String(number))}::numeric + ${bind(String(Math.max(Math.abs(number) * Number.EPSILON, Number.MIN_VALUE)))}::numeric` : 'FALSE'
            predicates.push(`CASE WHEN jsonb_typeof(${json}) = 'number' THEN ${numeric}
                WHEN ${ascii} THEN lower(${text} COLLATE "C") = ${value} ELSE TRUE END`)
        } else if (condition.operator === 'contains') {
            const value = bind(condition.value.toLowerCase())
            predicates.push(`CASE WHEN ${unusualNumber} OR NOT (${ascii}) THEN TRUE
                ELSE strpos(lower(${text} COLLATE "C"), ${value}) > 0 END`)
        } else {
            // A deliberately restricted common subset. Backreferences, lookarounds,
            // Unicode and JS escapes stay in the bounded worker, never translated
            // to a different regex dialect. Other conditions still narrow them.
            const expression = regexCandidate(condition.value)
            if (expression !== null) {
                const pattern = bind(expression)
                predicates.push(`CASE WHEN ${unusualNumber} OR NOT (${ascii}) THEN TRUE
                    ELSE ${text} COLLATE "C" ~* ${pattern} END`)
            }
        }
    }
    return predicates.length ? predicates.join(' AND ') : 'TRUE'
}
