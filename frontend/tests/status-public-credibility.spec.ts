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
    expect(status.checks).toHaveLength(7)
    expect(status.checks.map(check => check.service)).toEqual([
        'Core platform',
        'Website',
        'Threat Intelligence',
        'Threat Intelligence',
        'Threat Intelligence',
        'Dark Web Monitoring',
        'Dark Web Monitoring',
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

    expect(status.overall).toBe('degraded')
    expect(status.checks[0]).toMatchObject({
        service: 'Core platform',
        check_name: 'API Health',
        status: 'down',
    })
})

test('public status preserves the live canonical monitor feed used by production', () => {
    const now = Date.parse('2026-10-23T14:00:05.395Z')
    const checkedAt = '2026-10-23T14:00:03.550Z'
    const status = toPublicServiceStatus({
        overall: 'up',
        monitoring: 'live',
        generated_at: new Date(now).toISOString(),
        checks: [
            serviceCheck('core', 'API', checkedAt),
            serviceCheck('website', 'Website', checkedAt),
            serviceCheck('docker', 'Authentication', checkedAt),
            serviceCheck('docker', 'Mail', checkedAt),
        ],
        history: [],
        incidents: [],
    } satisfies ServiceStatus, now)

    expect(status).toMatchObject({ overall: 'up', monitoring: 'live' })
    expect(status.checks.map(check => check.check_name)).toEqual(['API', 'Website', 'Authentication', 'Mail'])
    expect(status.checks.every(check => check.status === 'up')).toBe(true)
    expect(status.last_verified_at).toBe(checkedAt)
})

test('public status is down only when API, website, and authentication are all down', () => {
    const now = Date.now()
    const checkedAt = new Date(now).toISOString()
    const checks = [
        serviceCheck('core', 'API', checkedAt),
        serviceCheck('website', 'Website', checkedAt),
        serviceCheck('docker', 'Authentication', checkedAt),
    ].map(check => ({ ...check, status: 'down' as const }))

    expect(toPublicServiceStatus({ overall: 'down', monitoring: 'live', generated_at: checkedAt, checks, history: [], incidents: [] }, now).overall).toBe('down')
    expect(toPublicServiceStatus({ overall: 'degraded', monitoring: 'live', generated_at: checkedAt, checks: [{ ...checks[0], status: 'down' }, { ...checks[1], status: 'up' }, { ...checks[2], status: 'up' }], history: [], incidents: [] }, now).overall).toBe('degraded')
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
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
            serviceCheck('content', 'Articles', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('up')
    expect(status.checks).toHaveLength(7)
    expect(status.checks.every(check => check.status === 'up')).toBe(true)
    expect(status.checks.find(check => check.check_name === 'Source Collection')?.status).toBe('up')
})

test('public status reports fresh processing and source-collection failures without raw details', () => {
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
            serviceCheck('dark-web-monitoring', 'Monitoring workspace', checkedAt),
            serviceCheck('dark-web-monitoring', 'Latest activity', checkedAt),
        ],
        history: [],
        incidents: [],
    }, now)

    expect(status.overall).toBe('degraded')
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

    expect(status.overall).toBe('degraded')
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
