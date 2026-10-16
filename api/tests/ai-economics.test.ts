import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: string[] = []

mock.module('#db', () => ({
    default: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('AS failed_platform_discount_nok')) {
            return { rows: [{ event_count: 24, estimated_cost_nok: 12, failed_platform_discount_nok: 37.5 }] }
        }
        if (sql.includes('SELECT id, kind, units, billable_units')) {
            return {
                rows: Array.from({ length: 20 }, (_, index) => ({
                    id: index + 1,
                    kind: 'ai_run_completed',
                    units: 1,
                    billable_units: 1,
                    estimated_cost_nok: 0.5,
                    billing_mode: 'standard',
                    outcome: 'verified',
                    metadata: {},
                    created_at: '2026-10-16T10:00:00.000Z',
                })),
            }
        }
        return { rows: [] }
    },
}))
mock.module('../src/handlers/ai/getModels.ts', () => ({
    readModelState: async () => ({ connected: [] }),
}))
mock.module('../src/handlers/ai/shared.ts', () => ({
    requireAiUser: async () => 'user-1',
}))

const { getAiEconomics } = await import('../src/handlers/ai/economics.ts')

test('platform failure discount covers the full usage window, independent of recent-run limit', async () => {
    queries.length = 0
    const app = Fastify()
    app.get('/ai/economics', getAiEconomics)

    try {
        const response = await app.inject({ method: 'GET', url: '/ai/economics?days=30' })

        expect(response.statusCode).toBe(200)
        expect(response.json().summary.failedPlatformDiscountNok).toBe(37.5)
        expect(queries.some((sql) => sql.includes('SUM(CASE WHEN outcome = \'platform_error\' THEN estimated_cost_nok ELSE 0 END)'))).toBe(true)
        expect(queries.some((sql) => sql.includes('LIMIT 20'))).toBe(true)
    } finally {
        await app.close()
    }
})
