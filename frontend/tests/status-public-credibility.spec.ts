import { expect, test } from '@playwright/test'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import type { ServiceStatus } from '@/utils/status/getStatus'
import { serviceCheck } from './status-public-fixtures'

test('public status does not claim operational health without fresh public checks', () => {
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: '2026-07-05T00:00:00.000Z',
        checks: [],
        history: [],
        incidents: [],
    }, Date.parse('2026-07-05T00:00:00.000Z'))

    expect(status.overall).toBe('unknown')
    expect(status.checks).toHaveLength(8)
    expect(status.checks.map(check => check.service)).toEqual([
        'Core platform',
        'Website',
        'Threat intelligence',
        'Threat intelligence',
        'Threat intelligence',
        'Sandbox',
        'Dark web monitoring',
        'Dark web monitoring',
    ])
    expect(status.checks[0]).toMatchObject({
        check_name: 'API Health',
        status: 'unknown',
        checked_at: '',
        uptime_30d: 'unverified',
    })
    expect(status.checks[0].message).toContain('last 5 minutes')
})

test('public status keeps fresh failing checks more severe than freshness fallback', () => {
    const now = Date.parse('2026-07-05T00:00:00.000Z')
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: '2026-07-05T00:00:00.000Z',
        checks: [{
            service: 'core',
            check_name: 'API health',
            status: 'down',
            latency_ms: 1200,
            message: 'Status probe failed.',
            checked_at: new Date(now).toISOString(),
            uptime_30d: '99.1',
        }],
        history: [],
        incidents: [],
    } satisfies ServiceStatus, now)

    expect(status.overall).toBe('down')
    expect(status.checks[0]).toMatchObject({
        service: 'Core platform',
        check_name: 'API Health',
        status: 'down',
    })
})

test('public status is operational only when every buyer-facing monitor is fresh', () => {
    const now = Date.parse('2026-07-05T00:05:00.000Z')
    const checkedAt = '2026-07-05T00:04:00.000Z'
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: new Date(now).toISOString(),
        checks: [
            serviceCheck('core', 'API health', checkedAt),
            serviceCheck('website', 'Public website', checkedAt),
            serviceCheck('threat-intelligence', 'Public search', checkedAt),
            serviceCheck('threat-intelligence', 'Processing backlog', checkedAt),
            serviceCheck('threat-intelligence', 'Source collection', checkedAt),
            serviceCheck('browser-sandbox', 'Browser workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
            serviceCheck('content', 'Articles', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('up')
    expect(status.checks).toHaveLength(8)
    expect(status.checks.every(check => check.status === 'up')).toBe(true)
    expect(status.checks.find(check => check.check_name === 'Source Collection')?.status).toBe('up')
})

test('public status cannot hide fresh processing or source-collection failures', () => {
    const now = Date.parse('2026-08-09T11:00:00.000Z')
    const checkedAt = new Date(now).toISOString()
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: checkedAt,
        checks: [
            serviceCheck('core', 'API health', checkedAt),
            serviceCheck('website', 'Public website', checkedAt),
            serviceCheck('threat-intelligence', 'Public search', checkedAt),
            { ...serviceCheck('threat-intelligence', 'Processing backlog', checkedAt), status: 'down', message: '5263 stale reviews (oldest 1848 minutes).' },
            { ...serviceCheck('threat-intelligence', 'Source collection', checkedAt), status: 'degraded', message: 'Source operations returned 76 sources; 1 failed.' },
            serviceCheck('browser-sandbox', 'Browser workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('down')
    expect(status.checks.find(check => check.check_name === 'Processing Backlog')).toMatchObject({
        status: 'down',
        message: 'Threat intelligence processing is delayed.',
    })
    expect(status.checks.find(check => check.check_name === 'Processing Backlog')?.message).not.toContain('5263')
    expect(status.checks.find(check => check.check_name === 'Source Collection')).toMatchObject({ status: 'degraded' })
})

test('public status preserves degraded source-collection evidence', () => {
    const now = Date.parse('2026-08-09T11:00:00.000Z')
    const checkedAt = new Date(now).toISOString()
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: checkedAt,
        checks: [
            serviceCheck('core', 'API health', checkedAt),
            serviceCheck('website', 'Public website', checkedAt),
            serviceCheck('threat-intelligence', 'Public search', checkedAt),
            { ...serviceCheck('threat-intelligence', 'Processing backlog', checkedAt), status: 'down', message: '5263 stale reviews (oldest 1848 minutes).' },
            { ...serviceCheck('threat-intelligence', 'Source collection', checkedAt), status: 'degraded', message: 'Source operations returned 76 sources; 1 failed.' },
            serviceCheck('browser-sandbox', 'Browser workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('down')
    expect(status.checks.find(check => check.check_name === 'Processing Backlog')).toMatchObject({
        status: 'down',
        message: 'Threat intelligence processing is delayed.',
    })
    expect(status.checks.find(check => check.check_name === 'Processing Backlog')?.message).not.toContain('5263')
    expect(status.checks.find(check => check.check_name === 'Source Collection')).toMatchObject({ status: 'degraded' })
})

test('public status exposes stale latest activity as a service failure', () => {
    const now = Date.parse('2026-08-08T23:20:00.000Z')
    const checkedAt = new Date(now).toISOString()
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: checkedAt,
        checks: [
            serviceCheck('core', 'API health', checkedAt),
            serviceCheck('website', 'Public website', checkedAt),
            serviceCheck('threat-intelligence', 'Public search', checkedAt),
            serviceCheck('browser-sandbox', 'Browser workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            {
                ...serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
                status: 'down',
                message: 'Latest customer activity is stale (113 minutes).',
            },
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('down')
    expect(status.checks.find(check => check.check_name === 'Latest Activity')).toMatchObject({
        status: 'down',
        message: 'The activity feed was 113 minutes out of date.',
    })
})

test('public status retains stale evidence while marking the feed stale', () => {
    const now = Date.parse('2026-07-05T00:10:01.000Z')
    const status = toPublicServiceStatus({
        overall: 'up',
        generated_at: new Date(now).toISOString(),
        checks: [serviceCheck('core', 'API health', '2026-07-05T00:05:00.000Z')],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('unknown')
    expect(status.checks[0]).toMatchObject({ status: 'up', checked_at: '2026-07-05T00:05:00.000Z' })
    expect(status.monitoring).toBe('unavailable')
})
