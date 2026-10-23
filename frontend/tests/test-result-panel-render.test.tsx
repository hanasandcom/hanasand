// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import TestClient from '../src/app/test/[...id]/pageClient'
import TestContent from '../src/components/test/testContent'

const run = {
    id: 'run-123', url: 'https://status.example.com/', timeout: 30,
    stages: [{ duration: '30s', target: 1 }], status: 'running', logs: [], errors: [],
    duration: { milliseconds: 0 }, created_at: '2026-10-23T00:00:00Z',
    finished_at: '', exit_code: 0, visits: 0, summary: {},
} as Test

test('result page has short headings and collapsible mobile panels', () => {
    const details = renderToStaticMarkup(<TestClient test={run} />)
    const results = renderToStaticMarkup(<TestContent test={run} showLogs showErrors={false} />)

    expect(details).toContain('>Details</h1>')
    expect(details).toContain('aria-label="Collapse details"')
    expect(details).toContain('href="/test"')
    expect(details).toContain('Test another endpoint')
    expect(details).toContain('>Rerun</span>')
    expect(details).not.toContain('Check details')
    expect(results).toContain('>Results</h1>')
    expect(results).toContain('aria-label="Collapse results"')
    expect(results).toContain('aria-label="Collapse run output"')
    expect(results).not.toContain('Test results')
    expect(results).not.toContain('Metrics, charts, logs, and evidence from the selected run.')
    expect(results).not.toContain('This run did not include time-series samples.')
})

test('completed result renders recorded time-series charts', () => {
    const completed = { ...run, status: 'done', summary: {
        requests: 12,
        duration: { p95: 42 },
        failureRate: 0,
        rps: [{ time: '0s', value: 2.4 }],
        latency: [{ time: '0s', p50: 30, p95: 42 }],
        errors: [{ time: '0s', count: 0 }],
    } } as Test
    const results = renderToStaticMarkup(<TestContent test={completed} showLogs showErrors={false} />)
    expect(results).toContain('Requests per second')
    expect(results).toContain('Latency')
    expect(results).not.toContain('No chart data')
})
