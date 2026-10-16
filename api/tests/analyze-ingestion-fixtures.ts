export function fixture() {
    const reqId = '67d04ac9-630e-4d75-a2b5-33ba95b81842'
    const timestamp = '2026-09-24T00:00:00.000Z'
    const structured = { level: 30, time: Date.parse(timestamp), pid: 123, hostname: 'api-test', reqId,
        msg: 'http_access', req: { method: 'POST', url: '/api/logs/ingest', body: { events: [{ message: 'retained submitted content' }] } },
        access: { key: `http-api:${reqId}`, ip: '127.0.0.1', timestamp, path: '/api/logs/ingest', method: 'POST', status: 201 } }
    return { service: 'hanasand-api-1', host: 'inspur', level: 'info' as const, timestamp, sourceEventId: 'a'.repeat(64),
        message: JSON.stringify(structured), metadata: { collector: 'docker', container_id: 'b'.repeat(64), stream: 'stdout', structured } }
}
