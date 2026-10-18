// @ts-expect-error Bun provides the test module for focused checks.
import { expect, test } from 'bun:test'
import type { TrafficMetrics } from '../src/utils/monitoring/types'
import type { TiAdminOverview } from '../src/utils/tiAdmin/types'
import { buildMonitorRows } from '../src/app/monitor/model'

const trafficMetrics = {
    top_domains: [{ key: 'traffic.example', count: 9 }, { key: 'shared.example', count: 8 }, { key: 'shared.example', count: 80 }],
} as TrafficMetrics

const ti = {
    domains: [{
        domain: 'shared.example', company: 'Shared Customer', matchedTerms: ['breach'], sourceIds: ['first', 'missing'],
        resultCount: 3, lastSeenAt: '2026-10-17T12:00:00Z', status: 'review',
    }],
    captures: [{ domain: 'shared.example', monitoredSince: '2026-10-01T00:00:00Z' }],
    sources: [
        { id: 'first', name: 'Primary source', domains: ['shared.example', 'source.example'], monitoredSince: '2026-09-01T00:00:00Z' },
        { id: 'first', name: 'Duplicate source id', domains: [], monitoredSince: '' },
        { id: 'second', name: 'Second source', domains: ['shared.example'], monitoredSince: '' },
    ],
} as unknown as TiAdminOverview

test('builds monitor rows in first-seen order with matching traffic and TI data', () => {
    const rows = buildMonitorRows({
        trafficMetrics,
        domainTraffic: [
            { value: 'traffic.example', hits_today: 2, hits_last_week: 5, hits_this_month: 7, hits_total: 10 },
            { value: 'shared.example', hits_today: 4, hits_last_week: 6, hits_this_month: 8, hits_total: 0 },
            { value: 'shared.example', hits_today: 40, hits_last_week: 60, hits_this_month: 80, hits_total: 100 },
            { value: 'source.example', hits_today: 0, hits_last_week: 0, hits_this_month: 0, hits_total: 0 },
        ],
        ti,
    })

    expect(rows).toEqual([
        {
            domain: 'traffic.example', customer: 'traffic', status: 'watching', monitoredSince: '', lastSeenAt: '',
            breachMentions: 0, matchedTerms: ['traffic.example'], sources: [], requestsToday: 2, requestsThisWeek: 5,
            requestsThisMonth: 7, requestsTotal: 10,
        },
        {
            domain: 'shared.example', customer: 'Shared Customer', status: 'review', monitoredSince: '2026-10-01T00:00:00Z',
            lastSeenAt: '2026-10-17T12:00:00Z', breachMentions: 3, matchedTerms: ['breach'], sources: ['Primary source'],
            requestsToday: 4, requestsThisWeek: 6, requestsThisMonth: 8, requestsTotal: 8,
        },
        {
            domain: 'source.example', customer: 'source', status: 'watching', monitoredSince: '2026-09-01T00:00:00Z',
            lastSeenAt: '', breachMentions: 0, matchedTerms: ['source.example'], sources: [], requestsToday: 0,
            requestsThisWeek: 0, requestsThisMonth: 0, requestsTotal: 0,
        },
    ])
})

test('uses source dates when captures are absent and excludes invalid domain metrics', () => {
    const rows = buildMonitorRows({
        trafficMetrics: 'unavailable',
        domainTraffic: [{ value: 'source.example', hits_today: 0, hits_last_week: 0, hits_total: 0 }],
        ti: { ...ti, captures: [] },
    })
    expect(rows.map(row => [row.domain, row.monitoredSince])).toEqual([
        ['source.example', '2026-09-01T00:00:00Z'],
        ['shared.example', '2026-09-01T00:00:00Z'],
    ])
    expect(buildMonitorRows({
        trafficMetrics: { top_domains: [{ key: '/path', count: 1 }, { key: '192.0.2.1', count: 1 }] } as TrafficMetrics,
        domainTraffic: [], ti: { ...ti, domains: [], captures: [], sources: [] } as TiAdminOverview,
    })).toEqual([])
})
