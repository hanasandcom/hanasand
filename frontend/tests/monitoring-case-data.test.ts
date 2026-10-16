import { expect, test } from 'bun:test'
import { caseEndpoint, mergeCaseEvents, type MonitoringCase } from '../src/app/dashboard/cases/monitoringCaseTypes'

const caseData = (overrides: Partial<MonitoringCase> = {}): MonitoringCase => ({
    id: 'case-1',
    title: 'Monitoring case',
    summary: 'A failed check',
    status: 'open',
    severity: 'high',
    occurrences: 3,
    automationId: 'health-check',
    notificationsEnabled: true,
    history: [],
    comments: [],
    notifications: [],
    ...overrides,
})

test('case detail URL encodes path and preserves organization scope', () => {
    expect(caseEndpoint('case/1', 'org & team')).toBe('/api/cases/case%2F1?organizationId=org+%26+team')
    expect(caseEndpoint('case-1')).toBe('/api/cases/case-1?')
})

test('event pagination deduplicates by ID and keeps the latest page metadata', () => {
    const first = caseData({
        events: [
            { id: 'event-1', startedAt: '2026-10-01T10:00:00Z', outcome: 'failed', message: 'Initial result' },
            { id: 'event-2', startedAt: '2026-10-01T09:00:00Z', outcome: 'passed', message: 'Earlier result' },
        ],
        eventPage: 1,
        eventTotal: 10,
    })
    const next = caseData({
        events: [
            { id: 'event-1', startedAt: '2026-10-01T10:00:00Z', outcome: 'failed', message: 'Updated result' },
            { id: 'event-3', startedAt: '2026-10-01T08:00:00Z', outcome: 'passed', message: 'Next page' },
        ],
        eventPage: 2,
        eventTotal: 12,
    })

    const merged = mergeCaseEvents(first, next)
    expect(merged.events?.map(event => event.id)).toEqual(['event-1', 'event-2', 'event-3'])
    expect(merged.events?.[0].message).toBe('Updated result')
    expect(merged.eventPage).toBe(2)
    expect(merged.eventTotal).toBe(12)
})
