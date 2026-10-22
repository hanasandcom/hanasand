// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import EndpointCheckPanel, { type ScenarioPreset } from '../src/app/test/EndpointCheckPanel'

const scenarios: ScenarioPreset[] = [
    { id: 'baseline', label: 'Baseline', detail: 'Single-user HTTP check.', stages: [{ duration: '30s', target: 1 }], timeout: 30_000 },
    { id: 'ramp', label: 'Ramp', detail: 'Gradual traffic increase.', stages: [{ duration: '30s', target: 5 }], timeout: 45_000 },
]

function renderPanel(overrides: Partial<Parameters<typeof EndpointCheckPanel>[0]> = {}) {
    return renderToStaticMarkup(<EndpointCheckPanel
        path='https://api.example.com/health'
        scenarioId='ramp'
        scenarios={scenarios}
        quotaLabel='3 free runs remaining'
        error={null}
        starting={false}
        recentScans={[]}
        onPathChange={() => {}}
        onScenarioChange={() => {}}
        onSubmit={() => {}}
        onEndpointKeyDown={() => {}}
        onNavigate={() => {}}
        {...overrides}
    />)
}

test('endpoint panel renders endpoint guidance, quota, and form labels', () => {
    const html = renderPanel()
    expect(html).toContain('Check a service before users do.')
    expect(html).toContain('Run an owned HTTP endpoint through a measured scenario with latency, failure-rate, logs, and a shareable result link.')
    expect(html).toContain('Enter the endpoint to check.')
    expect(html).toContain('3 free runs remaining')
    expect(html).toContain('value="https://api.example.com/health"')
    expect(html).not.toContain('Endpoint check')
    expect(html).toContain('Start test')
    expect(html).not.toContain('timeout')
    expect(html).not.toContain('p95 and failures')
    expect(html).not.toContain('logs and result link')
    expect(html).toContain('>Start check</button>')
    expect(html).toContain('Recent check history is updating.')
})

test('endpoint panel keeps the missing-result notice and recent scan summary', () => {
    const html = renderPanel({
        missingTestId: 'missing-run',
        recentScans: [{ id: 'recent-run', url: 'https://status.example.com', status: 'done' } as Test],
    })
    expect(html).toContain('The check &#x27;missing-run&#x27; does not exist yet.')
    expect(html).toContain('https://status.example.com')
    expect(html).toContain('done')
    expect(html).toContain('My checks')
    expect(html).toContain('Results')
})
