const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata'])
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan']

export function sandboxUrlSafety(value: string, options: { allowLocalTargets?: boolean } = {}): { ok: true } | { ok: false; reason: string } {
    let parsed: URL
    try {
        parsed = new URL(value)
    } catch {
        return { ok: false, reason: 'invalid URL' }
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, reason: 'only http and https URLs are allowed' }
    if (parsed.username || parsed.password) return { ok: false, reason: 'embedded credentials are not allowed' }
    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (!host) return { ok: false, reason: 'missing hostname' }
    if (!options.allowLocalTargets && BLOCKED_HOSTS.has(host)) return { ok: false, reason: 'internal hostname' }
    if (!options.allowLocalTargets && BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix))) return { ok: false, reason: 'internal hostname suffix' }
    if (!options.allowLocalTargets && (isBlockedIPv4Host(host) || isBlockedIPv6Host(host))) return { ok: false, reason: 'private or local network address' }
    return { ok: true }
}

function isBlockedIPv4Host(host: string) {
    const parts = host.split('.')
    if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part))) return false
    const octets = parts.map(Number)
    if (octets.some(octet => octet < 0 || octet > 255)) return false
    const [a, b] = octets
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

function isBlockedIPv6Host(host: string) {
    if (!host.includes(':')) return false
    const normalized = host.toLowerCase()
    const mappedIPv4 = ipv4FromMappedIPv6(normalized)
    if (mappedIPv4 && isBlockedIPv4Host(mappedIPv4)) return true
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc')
        || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('ff')
}

function ipv4FromMappedIPv6(host: string) {
    const match = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host)
    if (!match) return ''
    const high = Number.parseInt(match[1], 16)
    const low = Number.parseInt(match[2], 16)
    if ([high, low].some(part => !Number.isFinite(part) || part < 0 || part > 0xffff)) return ''
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}
