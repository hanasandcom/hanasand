export type NativeLogEntry = {
    id: string
    service: string
    host: string
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    message: string
    metadata: Record<string, unknown>
    created_at: string
    source: 'native'
}

export function detectLevel(message: string, priority?: string | number | null): NativeLogEntry['level'] {
    const numericPriority = typeof priority === 'number'
        ? priority
        : typeof priority === 'string' && /^\d+$/.test(priority)
            ? Number(priority)
            : null

    if (numericPriority !== null) {
        if (numericPriority <= 2) return 'fatal'
        if (numericPriority <= 3) return 'error'
        if (numericPriority === 4) return 'warn'
        if (numericPriority >= 7) return 'debug'
    }

    const normalized = message.toLowerCase()
    if (/\b(fatal|panic|crit(ical)?)\b/.test(normalized)) return 'fatal'
    if (/\b(error|exception|failed|failure|denied|invalid user|authentication failure)\b/.test(normalized)) return 'error'
    if (/\b(warn|warning)\b/.test(normalized)) return 'warn'
    if (/\b(debug|trace)\b/.test(normalized)) return 'debug'
    return 'info'
}

export function normalizeService(value?: string | null, fallback = 'system') {
    const normalized = (value || '').trim().replace(/\.service$/i, '').toLowerCase()
    if (!normalized) return fallback
    if (normalized === 'sshd' || normalized === 'ssh') return 'ssh'
    if (normalized === 'sudo') return 'sudo'
    return normalized
}

function normalizeTimestamp(value?: string | null) {
    const parsed = value ? new Date(value) : new Date()
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

export function toNativeEntry({
    service,
    host,
    message,
    createdAt,
    metadata,
    priority,
}: {
    service: string
    host?: string | null
    message: string
    createdAt?: string | null
    metadata?: Record<string, unknown>
    priority?: string | number | null
}) {
    const cleanedMessage = message.trim()
    if (!cleanedMessage) return null

    const created_at = normalizeTimestamp(createdAt)
    return {
        id: `${service}:${created_at}:${cleanedMessage.slice(0, 80)}`,
        service,
        host: host || 'localhost',
        level: detectLevel(cleanedMessage, priority),
        message: cleanedMessage,
        metadata: metadata || {},
        created_at,
        source: 'native' as const,
    }
}

export function dedupeLogs(logs: NativeLogEntry[]) {
    return [...new Map(logs.map((log) => [log.id, log])).values()]
}
