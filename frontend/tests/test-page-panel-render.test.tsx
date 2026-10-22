// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import EndpointCheckPanel, { type ScenarioPreset } from '../src/app/test/EndpointCheckPanel'
import { defaultCustomStages, scenarioPresets } from '../src/utils/test/trafficShapes'

const scenarios: ScenarioPreset[] = [
    { id: 'baseline', label: 'Baseline', detail: 'Single-user HTTP check.', stages: [{ duration: '30s', target: 1 }], timeout: 30_000 },
    { id: 'ramp', label: 'Ramp', detail: 'Gradual traffic increase.', stages: [{ duration: '30s', target: 5 }], timeout: 45_000 },
    { id: 'spike', label: 'Spike', detail: 'Short burst.', stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }], timeout: 60_000 },
    { id: 'custom', label: 'Custom', detail: 'Set your own traffic stages.', stages: [], timeout: 30_000 },
]

function renderPanel(overrides: Partial<Parameters<typeof EndpointCheckPanel>[0]> = {}) {
    return renderToStaticMarkup(<EndpointCheckPanel
        path='https://api.example.com/health'
        scenarioId='ramp'
        scenarios={scenarios}
        customStages={defaultCustomStages}
        quotaLabel='3 free runs remaining'
        error={null}
        starting={false}
        recentScans={[]}
        onPathChange={() => {}}
        onScenarioChange={() => {}}
        onCustomStagesChange={() => {}}
        onSubmit={() => {}}
        onEndpointKeyDown={() => {}}
        onNavigate={() => {}}
        {...overrides}
    />)
}

test('endpoint panel renders endpoint guidance, quota, and form labels', () => {
    const html = renderPanel()
    expect(html).toContain('Check a service before users do.')
    expect(html).toContain('Try your endpoint with some traffic and see how it holds up.')
    expect(html).not.toContain('owned HTTP endpoint')
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

test('custom traffic exposes the graph and precise input mode', () => {
    const html = renderPanel({ scenarioId: 'custom', scenarios: scenarioPresets })
    expect(html).toContain('Custom traffic')
    expect(html).toContain('Custom traffic graph')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('role="slider"')
    expect(html).toContain('Add stage')
})
