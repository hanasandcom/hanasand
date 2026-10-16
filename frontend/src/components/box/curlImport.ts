import type { HeaderRow, RequestDraft } from './types'

export function parseCurlCommand(value: string): RequestDraft | null {
    const trimmed = value.trim()
    if (!/^curl(?:\s|$)/i.test(trimmed)) {
        return null
    }

    const tokens = tokenizeShell(trimmed)
    if (tokens[0]?.toLowerCase() !== 'curl') {
        return null
    }

    let method = 'GET'
    let url = ''
    let body = ''
    const headers: HeaderRow[] = []

    for (let index = 1; index < tokens.length; index += 1) {
        const token = tokens[index]
        const next = tokens[index + 1]

        if ((token === '-X' || token === '--request') && next) {
            method = next.toUpperCase()
            index += 1
            continue
        }

        if ((token === '-H' || token === '--header') && next) {
            const header = parseHeaderLine(next)
            if (header) {
                headers.push(header)
            }
            index += 1
            continue
        }

        if ((token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-urlencode') && next) {
            body = body ? `${body}&${next}` : next
            if (method === 'GET') {
                method = 'POST'
            }
            index += 1
            continue
        }

        if (!token.startsWith('-') && !url) {
            url = token
        }
    }

    return url
        ? { method, url, headers: headers.length ? headers : [{ key: '', value: '' }], body }
        : null
}

export function parseHeaderLine(value: string): HeaderRow | null {
    const separator = value.indexOf(':')
    if (separator <= 0) {
        return null
    }

    return {
        key: value.slice(0, separator).trim(),
        value: value.slice(separator + 1).trim(),
    }
}

export function tokenizeShell(value: string) {
    const tokens: string[] = []
    let current = ''
    let quote: string | null = null
    let escaping = false

    for (const char of value) {
        if (escaping) {
            current += char
            escaping = false
            continue
        }

        if (char === '\\') {
            escaping = true
            continue
        }

        if (quote) {
            if (char === quote) {
                quote = null
            } else {
                current += char
            }
            continue
        }

        if (char.charCodeAt(0) === 34 || char.charCodeAt(0) === 39) {
            quote = char
            continue
        }

        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current)
                current = ''
            }
            continue
        }

        current += char
    }

    if (current) {
        tokens.push(current)
    }

    return tokens
}
