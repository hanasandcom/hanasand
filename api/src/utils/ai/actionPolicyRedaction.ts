const SECRET_METADATA_KEY_PATTERN = /secret|token|password|credential|key|authorization|cookie|session/i

export function redactAgentText(value: string) {
    return value
        .replace(/-----BEGIN (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----[\s\S]*?-----END (?:OPENSSH |RSA |EC |DSA |PRIVATE )?PRIVATE KEY-----/g, '[redacted-private-key]')
        .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]*/gi, '$1=[redacted]')
        .replace(/\b(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[redacted]')
        .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/gi, (match) => `${match.split(/[:=]/)[0]}=[redacted]`)
        .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[redacted-github-token]')
        .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-aws-key]')
}

export function redactAgentMetadata(metadata: Record<string, unknown>) {
    const redacted: Record<string, unknown> = {}
    const pending: Array<{
        source: Record<string, unknown> | unknown[]
        target: Record<string, unknown> | unknown[]
    }> = [{ source: metadata, target: redacted }]

    while (pending.length) {
        const { source, target } = pending.pop()!
        for (const [key, value] of Object.entries(source)) {
            const targetKey = Array.isArray(target) ? Number(key) : key
            if (!Array.isArray(source) && SECRET_METADATA_KEY_PATTERN.test(key)) {
                setMetadataValue(target, targetKey, '[redacted]')
            } else if (typeof value === 'string') {
                setMetadataValue(target, targetKey, redactAgentText(value).slice(0, 1000))
            } else if (Array.isArray(value)) {
                const nested: unknown[] = new Array(value.length)
                setMetadataValue(target, targetKey, nested)
                pending.push({ source: value, target: nested })
            } else if (value && typeof value === 'object') {
                const nested: Record<string, unknown> = {}
                setMetadataValue(target, targetKey, nested)
                pending.push({ source: value as Record<string, unknown>, target: nested })
            } else {
                setMetadataValue(target, targetKey, value)
            }
        }
    }
    return redacted
}

function setMetadataValue(target: Record<string, unknown> | unknown[], key: string | number, value: unknown) {
    if (Array.isArray(target)) {
        target[Number(key)] = value
    } else {
        target[String(key)] = value
    }
}
