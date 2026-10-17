import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: string[] = []
const queryParameters: unknown[][] = []

mock.module('#db', () => ({
    default: async (sql: string, values: unknown[] = []) => {
        queries.push(sql)
        queryParameters.push(values)
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
        if (sql.includes('AS avg_score')) {
            return { rows: [{ completed: 2, failed: 1, total: 3, avg_score: 81 }] }
        }
        if (sql.includes('AS category')) {
            return { rows: [{ category: 'timeout', kind: 'build', count: 2 }] }
        }
        if (sql.includes('durationMs')) {
            return { rows: [{ p50_ms: 111, p95_ms: 222, sample_count: 3 }] }
        }
        if (sql.includes('completed_at - created_at')) {
            return { rows: [{ p50_ms: 333, p95_ms: 444, sample_count: 4 }] }
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
    queryParameters.length = 0
    const app = Fastify()
    app.get('/ai/economics', getAiEconomics)

    try {
        const response = await app.inject({ method: 'GET', url: '/ai/economics?days=30' })

        expect(response.statusCode).toBe(200)
        expect(response.json().summary.failedPlatformDiscountNok).toBe(37.5)
        expect(response.json().commercialReadiness.items.map((item: { id: string }) => item.id)).toEqual([
            'durable_async_verification', 'deployment_ownership', 'safety_enforcement',
            'verified_outcome_economics', 'non_developer_ux', 'design_quality',
            'tiered_pricing', 'model_routing_after_measurement',
        ])
        expect(response.json().commercialReadiness.totalCount).toBe(8)
        expect(response.json().reliability.failedProofCategories).toEqual([
            { category: 'timeout', kind: 'build', count: 2 },
        ])
        expect(response.json().reliability.promptTiming).toMatchObject({
            p50FirstUsefulOutputMs: 111,
            p95FirstUsefulOutputMs: 222,
            sampleCount: 3,
        })
        expect(response.json().reliability.deployTiming).toMatchObject({
            p50PromptToVerifiedDeployMs: 333,
            p95PromptToVerifiedDeployMs: 444,
            sampleCount: 4,
        })
        expect(response.json().commercialReadiness.items.find((item: { id: string }) => item.id === 'design_quality').evidence).toContain(
            '3 durable design QA jobs in this window: 2 passed and 1 failed.',
        )
        expect(queries.some((sql) => sql.includes('SUM(CASE WHEN outcome = \'platform_error\' THEN estimated_cost_nok ELSE 0 END)'))).toBe(true)
        expect(queries.some((sql) => sql.includes('LIMIT 20'))).toBe(true)
    } finally {
        await app.close()
    }
})

test('clamps economics windows and scopes every query to the authenticated owner', async () => {
    const app = Fastify()
    app.get('/ai/economics', getAiEconomics)

    try {
        for (const [days, expected] of [[1, 7], [120, 90]]) {
            const firstQuery = queryParameters.length
            const response = await app.inject({ method: 'GET', url: `/ai/economics?days=${days}` })
            expect(response.statusCode).toBe(200)
            expect(response.json().windowDays).toBe(expected)

            const calls = queryParameters.slice(firstQuery)
            expect(calls.length).toBeGreaterThan(0)
            expect(calls.every(([ownerId]) => ownerId === 'user-1')).toBe(true)
            const windowedQueries = calls.filter((parameters) => parameters.length > 1)
            expect(windowedQueries.every(([, window]) => window === `${expected} days`)).toBe(true)
        }
    } finally {
        await app.close()
    }
})
