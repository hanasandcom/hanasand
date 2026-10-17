import type { RuntimeContainer, RuntimeLogEntry } from './types.ts'

function detectLevel(message: string): RuntimeLogEntry['level'] {
    const normalized = message.toLowerCase()

    if (/\b(fatal|panic|crit(ical)?)\b/.test(normalized)) return 'fatal'
    if (/\b(error|exception|failed|failure)\b/.test(normalized)) return 'error'
    if (/\b(warn|warning)\b/.test(normalized)) return 'warn'
    if (/\b(debug|trace)\b/.test(normalized)) return 'debug'
    return 'info'
}

export function parseFrameBuffer(buffer: Buffer) {
    const lines: string[] = []
    let cursor = 0

    while (cursor + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(cursor + 4)
        const frameStart = cursor + 8
        const frameEnd = frameStart + size

        if (frameEnd > buffer.length) break
        const payload = buffer.subarray(frameStart, frameEnd).toString('utf8')
        lines.push(...payload.split('\n'))
        cursor = frameEnd
    }

    if (!lines.length) {
        return buffer.toString('utf8').split('\n')
    }

    return lines
}

function splitLogTimestamp(line: string) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? UTC)(?:\s+|$)/)
    if (!match || Number.isNaN(Date.parse(match[1]))) return { message: line, timestamp: undefined }
    return { message: line.slice(match[0].length).trim(), timestamp: match[1] }
}

export function parseLogLine(line: string, container: RuntimeContainer): RuntimeLogEntry | null {
    // Docker also prefixes blank output lines. Do not turn those timestamps into
    // messages with a new poll-time timestamp that sorts above real log output.
    const outer = splitLogTimestamp(line.trim())
    let message = outer.message
    let createdAt = outer.timestamp
    if (!message) return null

    try {
        const parsed = JSON.parse(message) as Record<string, unknown>
        if (parsed && typeof parsed === 'object') {
            const structuredMessage = [parsed.log, parsed.message, parsed.msg].find(value => typeof value === 'string')
            const timestamp = typeof parsed.time === 'string' ? parsed.time : typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined
            if (typeof structuredMessage === 'string') {
                message = structuredMessage.trim()
                if (!createdAt && timestamp && !Number.isNaN(Date.parse(timestamp))) createdAt = timestamp
            }
        }
    } catch {
        // Plain-text container output remains readable as-is.
    }

    // Applications such as PostgreSQL add their own timestamp after Docker's.
    // Show the event time once in the row header, retaining the actual message.
    const inner = splitLogTimestamp(message)
    message = inner.message
    createdAt ||= inner.timestamp
    if (!message) return null
    createdAt ||= new Date().toISOString()

    return {
        id: `${container.id}:${createdAt}:${message.slice(0, 32)}`,
        container_id: container.id,
        service: container.name,
        image: container.image,
        level: detectLevel(message),
        message,
        created_at: createdAt,
        source: 'runtime',
    }
}
