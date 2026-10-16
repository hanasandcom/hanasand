import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('public status page renders unverified coverage without fake uptime', async () => {
    const source = await Promise.all([
        'src/app/status/statusDashboard/StatusOverview.tsx',
        'src/app/status/statusDashboard/StatusIncidentHistory.tsx',
        'src/app/status/statusDashboard/ServiceCheckRow.tsx',
        'src/app/status/statusDashboard/ServiceCheckRow.tsx',
        'src/app/status/statusDashboard/statusHistory.ts',
        'src/app/status/statusDashboard/statusFormatting.ts',
    ].map(file => readFile(path.join(root, file), 'utf8'))).then(files => files.join('\n'))

    expect(source).toContain('Incident history')
    expect(source).toContain('formatUptime(check.uptime_30d)')
    expect(source).toContain('function formatUptime')
    expect(source).toContain('historyDaysFor(status, check)')
    expect(source).toContain('No verified history')
    expect(source).toContain('/status/incidents/${day.incident.id}')
    expect(source).toContain('Showing last verified results')
    expect(source).not.toContain('{check.uptime_30d}%')
    expect(source).not.toContain('Array.from({ length: 45 }')
    expect(source).not.toContain('index > 38')
})

test('public footer does not hardcode operational status', async () => {
    const footer = await readFile(path.join(root, 'src/components/footer/footer.tsx'), 'utf8')

    expect(footer).toContain('fetch(\'/api/status?summary=true\'')
    expect(footer).toContain('useState<ServiceStatus[\'overall\'] | \'unknown\'>(\'unknown\')')
    expect(footer).toContain('return { label: \'Monitoring unavailable\', dotClass: \'bg-ui-muted\' }')
    expect(footer).not.toContain('<span className=\'h-2.5 w-2.5 rounded-full bg-ui-success shadow-sm\' />')
})
