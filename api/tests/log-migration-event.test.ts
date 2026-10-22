import { expect, test } from 'bun:test'
import { logMigrationEvent } from '../src/utils/logs/logMigrationEvent.ts'

test('migration preserves stable source identity and enforces the source organization scope', () => {
    const event = logMigrationEvent({
        id: 'event-row-id', organization_id: 'tenant-a', event_timestamp: '2026-10-22T12:00:00.000Z',
        normalized: { service: 'api', host: 'inspur', level: 'error', message: 'failed', source_event_id: 'source-id',
            metadata: { category: 'request', tenantId: 'other-tenant' } },
    })
    expect(event).toEqual({ service: 'api', host: 'inspur', level: 'error', message: 'failed',
        metadata: { category: 'request', tenantId: 'other-tenant', organizationId: 'tenant-a' },
        sourceEventId: 'source-id', timestamp: '2026-10-22T12:00:00.000Z' })
})

test('migration normalizes missing or unsupported event fields without exposing source identifiers as content', () => {
    expect(logMigrationEvent({ id: 'stable-id', organization_id: 'platform', event_timestamp: new Date('2026-10-22T12:00:00Z'), normalized: {} }))
        .toEqual({ service: 'hanasand-api', host: '', level: 'info', message: '(empty)', metadata: { organizationId: 'platform' },
            sourceEventId: 'stable-id', timestamp: '2026-10-22T12:00:00.000Z' })
})
