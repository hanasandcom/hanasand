import type { ToolResponse } from './types'

export function formatCurlCommand(request: NonNullable<ToolResponse['request']>) {
    const parts = ['curl', '-X', shellQuote(request.method), shellQuote(request.url)]

    for (const [key, value] of Object.entries(request.headers || {})) {
        parts.push('-H', shellQuote(`${key}: ${value}`))
    }

    if (request.body) {
        parts.push('--data-raw', shellQuote(request.body))
    }

    return parts.join(' ')
}

export function formatHttpRequest(request: NonNullable<ToolResponse['request']>) {
    const lines = [`${request.method.toUpperCase()} ${request.url}`]

    for (const [key, value] of Object.entries(request.headers || {})) {
        lines.push(`${key}: ${value}`)
    }

    if (request.body) {
        lines.push('', request.body)
    }

    return lines.join('\n')
}

export function shellQuote(value: string) {
    const quote = String.fromCharCode(39)
    const escapedQuote = quote + '\\' + quote + quote
    return quote + value.replace(/'/g, escapedQuote) + quote
}
