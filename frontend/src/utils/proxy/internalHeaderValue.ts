const UTF8_BASE64URL_PREFIX = 'utf8b64.'

/** Encode arbitrary UTF-8 text into an ASCII-only value for an internal request header. */
export function encodeInternalHeaderValue(value: string): string {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const base64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    return `${UTF8_BASE64URL_PREFIX}${base64url}`
}

/** Decode values written by encodeInternalHeaderValue; preserve legacy plain values. */
export function decodeInternalHeaderValue(value: string | null): string | undefined {
    if (value === null) return undefined
    if (!value.startsWith(UTF8_BASE64URL_PREFIX)) return value

    try {
        const payload = value.slice(UTF8_BASE64URL_PREFIX.length)
        if (!/^[A-Za-z0-9_-]*$/.test(payload)) return undefined
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        return encodeInternalHeaderValue(decoded) === value ? decoded : undefined
    } catch {
        return undefined
    }
}
