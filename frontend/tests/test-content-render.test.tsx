// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import TestContent from '../src/components/test/testContent'

test('test metrics and all time-series panels render from run summary data', () => {
    const run = {
        status: 'done',
        summary: {
            requests: 12,
            failureRate: 0.1,
            duration: { p95: 19 },
            rps: [{ time: '10:00', value: 4 }],
            latency: [{ time: '10:00', p50: 5, p95: 9 }],
            errors: [{ time: '10:00', count: 1 }],
        },
        logs: ['ready'],
        errors: ['timeout'],
    } as unknown as Test

    const html = renderToStaticMarkup(<TestContent test={run} showLogs showErrors />)

    for (const label of ['Requests', '12', 'p95 latency', '19ms', 'Failure rate', '10.0%', 'Requests per second', 'Latency', 'Errors over time']) {
        expect(html).toContain(label)
    }
    expect(html).toContain('ready')
    expect(html).toContain('timeout')
})

test('missing completed run metrics show empty states and evidence guidance', () => {
    const run = { status: 'done', summary: null, logs: [], errors: [] } as unknown as Test
    const html = renderToStaticMarkup(<TestContent test={run} showLogs={false} showErrors={false} />)

    expect(html).toContain('Aggregate metrics are collecting')
    expect(html).toContain('No chart data')
    expect(html).toContain('No request samples were recorded during this run.')
    expect(html).not.toContain('Chart data is collecting')
    expect(html).toContain('Logs and errors are hidden')
})
