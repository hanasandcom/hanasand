import type { PostgresLog } from '../src/utils/events/analyzePostgres.ts'

export function fixture(now = Date.now() - 1000): PostgresLog[] {
    return ['connection received: host=[local]', 'connection authorized: user=hanasand database=hanasand application_name=pg_isready',
        'disconnection: session time: 0:00:00.005 user=hanasand database=hanasand host=[local]'].map((message, i) => {
        const timestamp = new Date(now + [0, 2, 5][i]).toISOString()
        return { host: 'inspur', service: 'hanasand_database', level: 'info', timestamp, sourceEventId: String(i + 1).repeat(64),
            message: `${timestamp.replace('T', ' ').replace('Z', '')} UTC [123] LOG:  ${message}`,
            metadata: { collector: 'docker', container_id: 'abcdef012345', stream: 'stderr' } }
    })
}
