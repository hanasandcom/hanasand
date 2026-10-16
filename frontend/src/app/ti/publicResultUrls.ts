export function safePublicTiUrl(value?: string) {
    if (!value) return undefined
    try {
        const parsed = new URL(value)
        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
        if (
            !['http:', 'https:'].includes(parsed.protocol)
            || parsed.username
            || parsed.password
            || privatePublicHost(host)
            || /^(?:t\.me|telegram\.me|telegram\.dog)$/.test(host)
            || /\.onion$/.test(host)
            || [...parsed.searchParams.keys()].some(key => /(?:token|secret|password|authorization|cookie|api[_-]?key|signature)/i.test(key))
        ) return undefined
        return parsed.toString()
    } catch {
        return undefined
    }
}

function privatePublicHost(host: string) {
    if (!host.includes('.') && !host.includes(':')) return true
    if (host === 'localhost' || /\.(?:local|internal)$/.test(host)) return true
    if (host.includes(':')) return host === '::' || host === '::1' || /^0(?::0){6}:[01]$|(?:^|:)ffff:|^f[cd]|^fe[89ab]|^2001:db8:/i.test(host)
    if (!/^\d+(?:\.\d+){3}$/.test(host)) return false
    const octets = host.split('.').map(Number)
    if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true
    const [a, b] = octets
    return a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 0 || b === 168))
        || (a === 198 && (b === 18 || b === 19 || (b === 51 && octets[2] === 100)))
        || (a === 203 && b === 0 && octets[2] === 113)
}

export const PUBLIC_URL_FIELDS = new Set(['url', 'href', 'sourceurl', 'targeturl', 'messageurl'])
