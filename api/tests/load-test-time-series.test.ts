// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { LoadTestTimeSeriesCollector } from '../src/handlers/test/loadTestTimeSeries.ts'

function point(metric: string, value: number, offsetSeconds: number, start: number) {
    return JSON.stringify({
        metric,
        type: 'Point',
        data: { time: new Date(start + offsetSeconds * 1_000).toISOString(), value, tags: {} },
    })
}

test('k6 JSON points become bounded request, latency, and failure charts', () => {
    const start = Date.parse('2026-10-23T08:00:00Z')
    const collector = new LoadTestTimeSeriesCollector(start)
    const records = [
        point('http_reqs', 1, 1, start),
        point('http_req_duration', 20, 1, start),
        point('http_req_failed', 0, 1, start),
        point('http_reqs', 1, 2, start),
        point('http_req_duration', 40, 2, start),
        point('http_req_failed', 1, 2, start),
        point('http_reqs', 1, 7, start),
        point('http_req_duration', 60, 7, start),
    ]
    expect(collector.push(`${records.slice(0, 3).join('\n')}\n${records[3].slice(0, 40)}`)).toBe('')
    expect(collector.push(`${records[3].slice(40)}\n${records.slice(4).join('\n')}\n`)).toBe('')

    const result = collector.finish()
    expect(result.metrics.rps).toEqual([{ time: '0s', value: 0.4 }, { time: '5s', value: 0.2 }])
    expect(result.metrics.latency).toEqual([
        { time: '0s', p50: 20, p95: 40 },
        { time: '5s', p50: 60, p95: 60 },
    ])
    expect(result.metrics.errors).toEqual([{ time: '0s', count: 1 }, { time: '5s', count: 0 }])
})

test('non-metric console output remains visible and points after the run are ignored', () => {
    const start = Date.parse('2026-10-23T08:00:00Z')
    const collector = new LoadTestTimeSeriesCollector(start, 10)
    expect(collector.push('Runner is starting\n')).toBe('Runner is starting')
    collector.push(`${point('http_reqs', 1, 20, start)}\n`)
    expect(collector.finish()).toMatchObject({
        trailingText: '',
        metrics: { rps: [], latency: [], errors: [] },
    })
})
