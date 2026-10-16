import { createHash } from 'node:crypto'

export function fixture() {
    const timestamp = '2026-09-24T00:00:00.001123456Z'
    const reqId = '677bcfd0-835a-4b8c-bd9d-90deb2d4eec8'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 9, hostname: 'abcdef012345', reqId,
        access: { key: `http-cdn:${reqId}`, method: 'POST', path: '/api/traffic', status: 201, ip: '172.26.0.1',
            timestamp: new Date(timestamp).toISOString(), inspection: { version: 1, bodyEmpty: false, headersSafe: false, pathSafe: true } }, msg: 'http_access' }
    const log = { service: 'cdn', host: 'inspur', level: 'info', timestamp, sourceEventId: '', message: JSON.stringify(structured),
        metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stdout', structured } }
    encode(log)
    return log
}

export function encode(log: ReturnType<typeof fixture>) {
    log.message = JSON.stringify(log.metadata.structured)
    log.sourceEventId = createHash('sha256').update(`${log.host}:docker:${log.metadata.container_id}:${log.timestamp}:${log.message}`).digest('hex')
}
