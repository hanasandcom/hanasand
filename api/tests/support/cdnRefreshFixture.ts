import { createHash } from 'node:crypto'

export function fixture() {
    const timestamp = '2026-09-24T00:00:00.001000001Z'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 1, hostname: 'abcdef012345',
        refresh: { version: 1, status: 200, durationMs: 12.3, intervalMs: 5012 }, msg: 'Hot cached queries refreshed' }
    const log = { service: 'cdn', host: 'inspur', level: 'info', timestamp, sourceEventId: '', message: JSON.stringify(structured),
        metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stdout', structured } }
    encode(log)
    return log
}

export function sign(log: ReturnType<typeof fixture>) {
    log.sourceEventId = createHash('sha256').update(`${log.host}:docker:${log.metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}

export function encode(log: ReturnType<typeof fixture>) {
    log.message = JSON.stringify(log.metadata.structured)
    sign(log)
}
