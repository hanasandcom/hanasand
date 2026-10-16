export function safeDecodeCookieValue(value: string): string {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}
