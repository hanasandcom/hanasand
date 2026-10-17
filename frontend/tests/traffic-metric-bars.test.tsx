// @ts-expect-error Bun provides the test module for focused checks.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MetricBars from '../src/components/monitoring/traffic/metricBars'

test('metric bars preserve count values and total-based widths', () => {
    const html = renderToStaticMarkup(createElement(MetricBars, {
        entries: [{ key: 'GET', count: 25 }],
        total: 100,
    }))

    expect(html).toContain('>GET</div>')
    expect(html).toContain('>25</div>')
    expect(html).toContain('width:25%')
})

test('slow metric bars round duration while keeping the same total denominator', () => {
    const html = renderToStaticMarkup(createElement(MetricBars, {
        entries: [{ key: '/slow', avg_time: 1.6 }],
        total: 100,
    }))

    expect(html).toContain('>/slow</div>')
    expect(html).toContain('>2</div>')
    expect(html).toContain('width:2%')
})
