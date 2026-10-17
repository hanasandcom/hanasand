import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import StatusOverview from '../src/app/status/statusDashboard/StatusOverview'
import type { ServiceStatus } from '../src/utils/status/getStatus'

const root = process.cwd()

test('public status page renders stale and unverified results without fake uptime', () => {
    const yesterday = new Date()
    yesterday.setUTCHours(0, 0, 0, 0)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const incidentDate = yesterday.toISOString().slice(0, 10)
    const status: ServiceStatus = {
        overall: 'unknown',
        monitoring: 'unavailable',
        generated_at: '',
        last_verified_at: '2026-10-16T12:00:00.000Z',
        checks: [{
            service: 'Core platform',
            check_name: 'API Health',
            status: 'unknown',
            latency_ms: 0,
            message: 'Monitoring unavailable.',
            checked_at: '',
            uptime_30d: 'unverified',
        }],
        history: [{
            service: 'Core platform',
            check_name: 'API Health',
            date: incidentDate,
            status: 'down',
            incident_ids: ['incident-42'],
            samples: 2,
            healthy_samples: 0,
            degraded_samples: 0,
            failed_samples: 2,
        }],
        incidents: [{
            id: 'incident-42',
            service: 'Core platform',
            check_name: 'API Health',
            title: 'API interruption',
            impact: 'Outage',
            status: 'resolved',
            started_at: `${incidentDate}T10:00:00.000Z`,
            resolved_at: `${incidentDate}T10:05:00.000Z`,
            summary: 'API checks failed.',
            cause: 'Unknown',
            updates: [],
        }],
    }
    const markup = renderToStaticMarkup(createElement(StatusOverview, {
        status,
        monitoringUnavailable: true,
        now: null,
    }))

    expect(markup).toContain('Monitoring unavailable')
    expect(markup).toContain('Showing last verified results')
    expect(markup).toContain('No verified history')
    expect(markup).toContain('aria-label="API Health unverified uptime"')
    expect(markup).toContain('>Unverified</span>')
    expect(markup).toContain('href="/status/incidents"')
    expect(markup).toContain('href="/status/incidents/incident-42"')
    expect(markup).not.toMatch(/aria-label="API Health \d+(?:\.\d+)?% uptime"/)
})

test('public footer does not hardcode operational status', async () => {
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    expect(footer).toContain('fetch(\'/api/status?summary=true\'')
    expect(footer).toContain('useState<ServiceStatus[\'overall\'] | \'unknown\'>(\'unknown\')')
    expect(footer).toContain('return { label: \'Monitoring unavailable\', dotClass: \'bg-ui-muted\' }')
    expect(footer).not.toContain('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-success shadow-sm\' />')
})
