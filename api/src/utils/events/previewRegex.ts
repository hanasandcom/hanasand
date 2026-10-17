import type { Condition } from './conditions.ts'

// Expand only anchored finite regexes made from literal characters, alternation,
// groups, and small character classes. Anything else stays with the JS matcher.
export function finiteRegexAlternatives(expression: string, limit = 64): string[] | null {
    if (!expression.startsWith('^') || !expression.endsWith('$')) return null
    const source = expression.slice(1, -1)
    let offset = 0
    const combine = (left: string[], right: string[]): string[] | null => left.length * right.length > limit
        ? null : left.flatMap(prefix => right.map(suffix => prefix + suffix))
    const parseClass = (): string[] | null => {
        const end = source.indexOf(']', offset + 1)
        if (end < 0) return null
        const contents = source.slice(offset + 1, end)
        if (!contents || contents.startsWith('^')) return null
        let values: string[]
        const range = /^([A-Za-z0-9])-([A-Za-z0-9])$/.exec(contents)
        if (range) {
            const [, first, last] = range
            if (first.charCodeAt(0) > last.charCodeAt(0)) return null
            values = Array.from({ length: last.charCodeAt(0) - first.charCodeAt(0) + 1 }, (_, index) => String.fromCharCode(first.charCodeAt(0) + index))
        } else {
            if (!/^[A-Za-z0-9_-]+$/.test(contents) || (contents.includes('-') && !contents.startsWith('-') && !contents.endsWith('-'))) return null
            values = [...contents]
        }
        if (values.some(value => !/[A-Za-z0-9_-]/.test(value)) || values.length > limit) return null
        offset = end + 1
        return values
    }
    const parsePiece = (): string[] | null => {
        const char = source[offset]
        if (char === '(') {
            offset++
            if (source.slice(offset, offset + 2) === '?:') offset += 2
            const values = parseAlternatives(true)
            if (!values || source[offset] !== ')') return null
            offset++
            return values
        }
        if (char === '[') return parseClass()
        if (char === '\\') {
            const escaped = source[offset + 1]
            if (!escaped || !'.[]{}()*+?^$|\\-'.includes(escaped)) return null
            offset += 2
            return [escaped]
        }
        if (!/[A-Za-z0-9_-]/.test(char || '')) return null
        offset++
        return [char]
    }
    const parseSequence = (): string[] | null => {
        let sequence = ['']
        while (offset < source.length) {
            const char = source[offset]
            if (char === '|' || char === ')') break
            const piece = parsePiece()
            if (!piece) return null
            const combined = combine(sequence, piece)
            if (!combined) return null
            sequence = combined
        }
        return sequence
    }
    const parseAlternatives = (insideGroup = false): string[] | null => {
        const alternatives: string[] = []
        let sequence = parseSequence()
        if (!sequence) return null
        alternatives.push(...sequence)
        while (source[offset] === '|') {
            offset++
            sequence = parseSequence()
            if (!sequence) return null
            alternatives.push(...sequence)
            if (alternatives.length > limit) return null
        }
        if (insideGroup && source[offset] !== ')') return null
        return alternatives
    }
    const values = parseAlternatives()
    if (!values || offset !== source.length || values.length > limit) return null
    return [...new Set(values)]
}

export function regexCandidate(expression: string): string | null {
    const token = /(?:\(\?:|[A-Za-z0-9 _:/@,=-]|[.^$*+?()|]|\{\d+(?:,\d*)?\}|\[\^?[A-Za-z0-9 _:/@,=.-]+\]|\\[dDwWsSbB]|\\[.^$*+?()|{}[\]\\])/gy
    let offset = 0, pattern = ''
    while (offset < expression.length) {
        if (expression.startsWith('(?', offset) && !expression.startsWith('(?:', offset)) return null
        token.lastIndex = offset
        const match = token.exec(expression)
        if (!match) return null
        const part = match[0]
        // PostgreSQL bounds repetition counts at 255; JavaScript does not.
        if (part.startsWith('{') && part.match(/\d+/g)!.some(count => Number(count) > 255)) return null
        pattern += ({ '(?:': '(', '\\d': '[0-9]', '\\D': '[^0-9]', '\\w': '[A-Za-z0-9_]', '\\W': '[^A-Za-z0-9_]', '\\s': '[[:space:]]', '\\S': '[^[:space:]]', '\\b': '\\y', '\\B': '\\Y', '$': '' } as Record<string, string>)[part] ?? part
        offset = token.lastIndex
    }
    return pattern
}

export function hasPostgresRegexCandidate(condition: Condition) {
    return condition.path === 'message' && condition.operator === 'regex' && regexCandidate(condition.value) !== null
}

function executableRegexLiterals(expression: string): string[] | null {
    if (!expression.startsWith('^') || !expression.endsWith('$')) return null
    let body = expression.slice(1, -1)
    const grouped = (body.startsWith('(?:') && body.endsWith(')')) || (body.startsWith('(') && body.endsWith(')'))
    if (grouped) body = body.startsWith('(?:') ? body.slice(3, -1) : body.slice(1, -1)

    const alternatives: string[] = []
    let current = '', escaped = false
    for (const character of body) {
        if (escaped) {
            current += `\\${character}`
            escaped = false
        } else if (character === '\\') escaped = true
        else if (character === '|') {
            if (!grouped) return null
            alternatives.push(current)
            current = ''
        } else current += character
    }
    if (escaped) return null
    alternatives.push(current)

    const literals = alternatives.map(alternative => {
        let literal = ''
        for (let index = 0; index < alternative.length; index++) {
            const character = alternative[index]
            if (character === '\\') {
                const escapedCharacter = alternative[++index]
                if (!escapedCharacter || !'.\\/|_-+?*()[]{}^$'.includes(escapedCharacter)) return null
                literal += escapedCharacter
            } else if (/[A-Za-z0-9/_-]/.test(character)) literal += character
            else return null
        }
        return literal && /^[\x20-\x7e]+$/.test(literal) ? literal : null
    })
    return literals.every((literal): literal is string => Boolean(literal)) ? [...new Set(literals)] : null
}

export function executableConditionLiterals(condition: Condition): string[] | null {
    if (condition.path !== 'process.executable') return null
    if (condition.operator === 'equals') return /^[\x20-\x7e]+$/.test(condition.value) && condition.value ? [condition.value] : null
    return condition.operator === 'regex' ? executableRegexLiterals(condition.value) : null
}

export function hasIndexedProcessExecutableSelector(conditions: Condition[]) {
    return conditions.some(condition => executableConditionLiterals(condition) !== null)
}
