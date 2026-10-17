// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import GPTContent from '../src/components/gpt/content'
import defaultModelMetrics from '../src/components/gpt/defaultModelMetrics'
import { DisplayClientDetails } from '../src/components/gpt/displayClient'
import { SensorMetric } from '../src/components/gpt/metric'

test('GPT summary cards preserve their shared markup and card-specific readings', () => {
    const client: GPT_Client = {
        name: 'Worker',
        ram: [{ name: 'Memory A', load: 0.42 }, { name: 'Memory B', load: 0.58 }],
        cpu: [{ name: 'CPU A', load: 0.25 }, { name: 'CPU B', load: 0.5 }],
        gpu: [{ name: 'GPU A', load: 0.6, memoryUsedMb: 1024, memoryTotalMb: 2048, powerDrawWatts: 120, powerLimitWatts: 150, temperatureC: 80 }],
        lanes: [],
        model: { ...defaultModelMetrics(), tps: 2.5 },
        power: { totalWatts: 86, monthlyKwh: 1.25, sampledAt: '2026-10-17T00:00:00Z' },
    }
    const html = renderToStaticMarkup(<GPTContent clients={[client]} onTestClient={() => {}} />)
    const shell = '<div class="rounded-lg bg-ui-panel p-4 border border-ui-border"><div class="flex items-center justify-between text-ui-muted"><span class="text-xs font-medium uppercase tracking-[0.18em]">'

    expect((html.match(/<div class="rounded-lg bg-ui-panel p-4 border border-ui-border"><div class="flex items-center justify-between text-ui-muted">/g) || []).length).toBe(6)
    for (const title of ['RAM load', 'CPU load', 'GPU load', 'Throughput', 'Lane capacity', 'Power']) expect(html).toContain(`${shell}${title}</span>`)
    expect(html).toContain('<span class="text-2xl">50%</span>')
    expect(html).toContain('<span class="text-2xl">38%</span>')
    expect(html).toContain('2.5 TPS')
    expect(html).toContain('0/0')
    expect(html).toContain('86 W')
    expect(html).toContain('1.25 kWh recorded this month · GPU power')
    expect(html).toContain('Live telemetry')
    expect(html).toContain('Status</div><div class="mt-1 text-sm font-semibold text-ui-text/90">idle</div>')

    const sensor = renderToStaticMarkup(<SensorMetric name='CPU Core 0' load={0.25} />)
    expect(sensor).toContain('<h1 class="text-sm text-ui-muted">CPU Core 0</h1>')
    expect(sensor).toContain('<span class="text-sm">25%</span>')

    const details = renderToStaticMarkup(<DisplayClientDetails client={client} />)
    expect(details).toContain('<h1 class="text-sm text-ui-muted">Memory A</h1>')
    expect(details).toContain('<span class="text-sm">42%</span>')
    expect(details).toContain('<h1 class="text-sm text-ui-muted">CPU A</h1>')
    expect(details).toContain('<span class="text-sm">25%</span>')
    expect(details).toContain('GPU A')
    expect(details).toContain('1/2 GB')
    expect(details).toContain('120 W')
    expect(details).toContain('80°C')
})
