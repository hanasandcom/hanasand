import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
let authorized = true
let administrator = true
let queries = 0
const storedServices = [
    { service: 'api', last_seen: new Date('2026-10-15T10:00:00.000Z'), entries: 2 },
    { service: 'stored', last_seen: new Date('2026-10-15T09:00:00.000Z'), entries: 1 },
]
const nativeServices = [
    { service: 'api', last_seen: '2026-10-15T11:00:00.000Z', entries: 3 },
    { service: 'native', last_seen: '2026-10-15T08:00:00.000Z', entries: 4 },
]
const query = async (sql: string) => {
    queries++
    return { rows: sql.includes('SELECT normalized->>\'service\'') ? storedServices : [] }
}
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: administrator }) }))
mock.module('../src/utils/logs/native.ts', () => ({ listNativeLogs: async () => [], listNativeLogServices: async () => nativeServices, isNativeLogSourceAvailable: () => false }))
mock.module('../src/utils/docker/engine.ts', () => ({ listRuntimeLogs: async () => ({ logs: [], containers: [] }), isRuntimeLogSourceAvailable: () => false }))
const { getLogs, getLogServices } = await import('../src/handlers/logs/get.ts')
const { getErrorEvents } = await import('../src/handlers/logs/errors.ts')
const { getMostActiveServices } = await import('../src/handlers/logs/mostActive.ts')

test('cached log responses still require a valid administrator on every request', async () => {
    const app = Fastify()
    app.get('/logs', getLogs)
    app.get('/logs/services', getLogServices)
    app.get('/logs/services/summary', getMostActiveServices)
    app.get('/logs/errors', getErrorEvents)
    try {
        for (const url of ['/logs', '/logs/services', '/logs/services/summary', '/logs/errors']) {
            authorized = administrator = true
            const response = await app.inject(url)
            expect(response.statusCode).toBe(200)
            if (url === '/logs/services') expect(response.json().services).toEqual([
                { service: 'api', last_seen: '2026-10-15T11:00:00.000Z', entries: 5 },
                { service: 'native', last_seen: '2026-10-15T08:00:00.000Z', entries: 4 },
                { service: 'stored', last_seen: '2026-10-15T09:00:00.000Z', entries: 1 },
            ])
            const before = queries
            expect((await app.inject(url)).statusCode).toBe(200)
            expect(queries).toBe(before)
            authorized = false
            expect((await app.inject(url)).statusCode).toBe(401)
            authorized = true
            administrator = false
            expect((await app.inject(url)).statusCode).toBe(403)
            expect(queries).toBe(before)
        }
    } finally { await app.close() }
})
