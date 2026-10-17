// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentAutomation } from '../src/utils/automations/client'
import { HealthCheckStatusPill } from '../src/app/dashboard/automation/healthCheckStatusPill'

const automation = (overrides: Partial<AgentAutomation> = {}) => ({
    id: 'monitor', name: 'Monitor', actionType: 'agent_prompt', monitoringType: 'fetch',
    targetUrl: 'https://example.test', status: 'active', lastStatus: 'completed', consecutiveFailures: 0,
    ...overrides,
} as AgentAutomation)

test('health status pill preserves row and detail markup and status tones', () => {
    const failed = renderToStaticMarkup(<HealthCheckStatusPill automation={automation({ lastStatus: 'failed' })} variant='row' />)
    const warning = renderToStaticMarkup(<HealthCheckStatusPill automation={automation({ lastStatus: 'warning' })} variant='details' />)
    const awaiting = renderToStaticMarkup(<HealthCheckStatusPill automation={automation({ monitoringType: 'push', targetUrl: 'sensor-1', lastStatus: null })} variant='row' />)

    expect(failed).toBe('<span class="w-fit rounded-full px-2 py-1 text-xs font-semibold bg-ui-raised/10 text-ui-text">Unhealthy</span>')
    expect(warning).toBe('<span class="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-ui-warning/10 text-ui-warning">Warning</span>')
    expect(awaiting).toBe('<span class="w-fit rounded-full px-2 py-1 text-xs font-semibold bg-ui-raised text-ui-muted">Awaiting reading</span>')
})
