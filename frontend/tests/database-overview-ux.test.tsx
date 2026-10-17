// @ts-expect-error Bun provides this module when running focused tests.
import { expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DatabaseOverview } from '../src/utils/db/internal'

mock.module('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }))
const { DatabaseDashboard } = await import('../src/app/dashboard/db/databaseDashboard')

const overview: DatabaseOverview = {
    status: 'healthy',
    generatedAt: '2026-10-17T10:00:00.000Z',
    clusterCount: 1,
    databaseCount: 1,
    totalSizeBytes: 2_500_000_000,
    activeQueries: 2,
    averageQuerySeconds: 4,
    longRunningThresholdSeconds: 60,
    health: { message: 'Database telemetry is available.' },
    longestQuery: {
        database: 'orders', user: 'application', state: 'active', durationSeconds: 75,
        waitEventType: 'Lock', waitEvent: 'transactionid', query: 'select * from orders', isLongRunning: true,
    },
    queries: [{
        database: 'orders', user: 'application', state: 'active', durationSeconds: 75,
        waitEventType: 'Lock', waitEvent: 'transactionid', query: 'select * from orders', isLongRunning: true,
    }],
    querySummary: { count: 2, longRunningCount: 1, longestDurationSeconds: 75 },
    storage: {
        sampledAt: '2026-10-17T09:55:00.000Z', host: 'db-host-1',
        disk: { totalBytes: 1_000_000_000_000, availableBytes: 400_000_000_000, dailyGrowthBytes: 20_000_000_000, daysUntilFull: 30, sampleSeconds: 86_400 },
        instances: [{
            id: 'primary', engine: 'PostgreSQL', status: 'healthy',
            databases: [{ name: 'orders', sizeBytes: 25_000_000, connections: 8, tableCount: 12 }],
        }],
    },
    clusters: [{
        id: 'cluster-primary', name: 'Primary cluster', engine: 'PostgreSQL', version: '16', host: 'db-host-1',
        activeQueries: 2, totalSizeBytes: 2_500_000_000, databaseCount: 1,
        databases: [{ name: 'orders', sizeBytes: 2_500_000_000, tableCount: 12, activeConnections: 8, tables: [{ schema: 'public', name: 'orders', estimatedRows: 300 }] }],
    }],
}

test('database overview renders storage telemetry before query disclosure', () => {
    const html = renderToStaticMarkup(createElement(DatabaseDashboard, { overview }))

    expect(html).toContain('aria-label="Storage health"')
    expect(html).toContain('400.00 GB')
    expect(html).toContain('20.00 GB')
    expect(html).toContain('30 days')
    expect(html).toContain('Database health')
    expect(html).toContain('Storage and databases')
    expect(html).toContain('href="/db/backups"')
    expect(html).toContain('href="/db/restore"')
    expect(html).toContain('db-host-1')
    expect(html).toContain('primary')
    expect(html).toContain('orders')
    expect(html).toContain('>12<')
    expect(html).toContain('2 shown · 1 long-running · Longest 1m · Threshold 1m · Checked 10:00 UTC')
    expect(html).toContain('Open to load query activity.')
    expect(html).not.toContain('select * from orders')

    expect(html.indexOf('Storage and databases')).toBeLessThan(html.indexOf('id="active-queries"'))
})
