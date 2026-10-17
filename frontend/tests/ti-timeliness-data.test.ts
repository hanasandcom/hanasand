import { expect, test } from 'bun:test'
import { buildReadUrl, buildWriteUrl, date, duration, percent } from '../src/app/dashboard/ti/timeliness/data'
import { formatAuditTime } from '../src/app/dashboard/helpdesk/auditPresentation'

test('timeliness reads preserve normalized tenant, queue and search filters', () => {
    const url = new URL(buildReadUrl({ scope: 'tenant', tenantId: ' org / one ', status: 'awaiting_delivery', query: 'actor & source' }), 'https://hanasand.test')
    expect(url.pathname).toBe('/api/ti/timeliness')
    expect(url.searchParams.get('scope')).toBe('tenant')
    expect(url.searchParams.get('limit')).toBe('200')
    expect(url.searchParams.get('tenantId')).toBe('org / one')
    expect(url.searchParams.get('status')).toBe('awaiting_delivery')
    expect(url.searchParams.get('q')).toBe('actor & source')
})

test('global scope omits tenant and optional filters while evidence writes retain tenant scope', () => {
    const read = new URL(buildReadUrl({ scope: 'global', tenantId: 'ignored', status: '', query: '' }), 'https://hanasand.test')
    expect(read.searchParams.get('scope')).toBe('global')
    expect(read.searchParams.has('tenantId')).toBe(false)
    expect(read.searchParams.has('status')).toBe(false)
    expect(read.searchParams.has('q')).toBe(false)
    expect(buildWriteUrl('tenant', ' org-1 ')).toBe('/api/ti/timeliness?scope=tenant&tenantId=org-1')
})

test('date and metric formatting preserve invalid timestamps and threshold boundaries', () => {
    const invalid = 'not-a-date'
    const valid = '2026-07-22T10:00:00Z'
    const expected = new Date(valid).toLocaleString()
    expect(date(invalid)).toBe(invalid)
    expect(formatAuditTime(invalid)).toBe(invalid)
    expect(date(valid)).toBe(expected)
    expect(formatAuditTime(valid)).toBe(expected)
    expect(duration(59)).toBe('59s')
    expect(duration(60)).toBe('1.0m')
    expect(duration(3600)).toBe('1.0h')
    expect(duration(null)).toBe('—')
    expect(percent(0.755)).toBe('76%')
})
