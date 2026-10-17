import { describe, expect, test } from 'bun:test'
import { dedupeScans, isValidServiceUrl, latestP95, loadTestStatusCounts } from '../src/app/dashboard/load-testing/loadTestingScenarios'

describe('load testing scan helpers', () => {
    test('accepts only dotted HTTP and HTTPS service URLs', () => {
        expect(isValidServiceUrl(' https://api.example.com/health ')).toBe(true)
        expect(isValidServiceUrl('http://localhost:8080')).toBe(false)
        expect(isValidServiceUrl('ftp://api.example.com')).toBe(false)
        expect(isValidServiceUrl('not a url')).toBe(false)
    })

    test('deduplicates mine-first results and orders the remaining scans newest first', () => {
        const mine = scan('shared', '2026-07-03T09:00:00.000Z')
        const global = scan('global', '2026-07-03T09:02:00.000Z')
        const duplicate = scan('shared', '2026-07-03T09:05:00.000Z')

        expect(dedupeScans([mine, global, duplicate]).map(item => item.id)).toEqual(['global', 'shared'])
    })

    test('uses the latest p95 summary and falls back to the stored summary', () => {
        expect(latestP95(scan('latest', '2026-07-03T09:00:00.000Z', 183.7))).toBe(184)
        expect(latestP95(scan('fallback', '2026-07-03T09:00:00.000Z', undefined, 94.5))).toBe(95)
        expect(latestP95(scan('missing', '2026-07-03T09:00:00.000Z'))).toBeNull()
    })

    test('counts queued, running, and failed scans using case-insensitive status values', () => {
        const scans = ['QUEUED', 'running', 'Failed', 'ERROR', 'done'].map((status, index) => ({
            ...scan(String(index), `2026-07-03T09:0${index}:00.000Z`), status,
        }))
        expect(loadTestStatusCounts(scans)).toEqual({ queued: 1, running: 1, failed: 2 })
    })
})

function scan(id: string, createdAt: string, latestP95Value?: number, summaryP95 = 0): Test {
    return {
        id,
        url: `https://${id}.example.com`,
        timeout: 30_000,
        stages: { default: true },
        status: 'done',
        logs: [],
        errors: [],
        duration: { milliseconds: 0 },
        created_at: createdAt,
        finished_at: createdAt,
        exit_code: 0,
        visits: 1,
        summary: { duration: summaryP95 ? { p95: summaryP95 } : undefined },
        latest_run_summary: latestP95Value === undefined ? undefined : { duration: { p95: latestP95Value } },
    }
}
