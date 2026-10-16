import { isDeepStrictEqual } from 'node:util'

export function matchesCanonicalJson(message: string, expected: unknown): boolean {
    try {
        const parsed = JSON.parse(message)
        return JSON.stringify(parsed) === message && isDeepStrictEqual(parsed, expected)
    } catch {
        return false
    }
}
