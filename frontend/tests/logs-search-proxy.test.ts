// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { applyOrganizationId, backendTargetBase } from '../src/utils/proxy/backendTarget'

const api = 'http://api:8080/api'
const ai = 'http://ai:19182/api'

test('configured Logs read requests leave the Hanasand API route only when Logs owns the endpoint', () => {
    expect(backendTargetBase(['logs', 'search'], api, ai, 'https://logs.hanasand.com/api/'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'realtime'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'services'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'services', 'summary'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'metrics'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'metrics', 'public'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'tuning'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'errors'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['rules', 'hits'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['rules', 'drop.audit.v1', 'hits'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['rules', 'drop.audit.v1', 'storage-estimate'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'tuning', 'refresh'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: 'https://logs.hanasand.com/api', directLogsRead: true })
    expect(backendTargetBase(['logs', 'search'], api, ai))
        .toEqual({ url: api, directLogsRead: false })
    expect(backendTargetBase(['logs', 'search'], api, ai, 'https://logs.hanasand.com/api', false))
        .toEqual({
            url: 'https://logs.hanasand.com/api',
            directLogsRead: false,
            blocked: 'Logs reads are unavailable while impersonating another account.',
        })
    expect(backendTargetBase(['ai', 'chat'], api, ai, 'https://logs.hanasand.com/api'))
        .toEqual({ url: ai, directLogsRead: false })
})

test('direct Logs reads receive the active organization without replacing an explicit choice', () => {
    const scoped = applyOrganizationId(new URL('https://logs.hanasand.com/api/logs/search'), 'tenant-a')
    expect(scoped.searchParams.get('organizationId')).toBe('tenant-a')
    const selected = applyOrganizationId(new URL('https://logs.hanasand.com/api/logs/search?organizationId=tenant-b'), 'tenant-a')
    expect(selected.searchParams.get('organizationId')).toBe('tenant-b')
})
