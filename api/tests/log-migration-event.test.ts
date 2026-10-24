import { expect, test } from 'bun:test'
import { logMigrationEvent } from '../src/utils/logs/logMigrationEvent.ts'

test('migration preserves stable source identity and enforces the source organization scope', () => {
    const event = logMigrationEvent({
        id: 'event-row-id', organization_id: 'tenant-a', event_timestamp: '2026-10-22T12:00:00.000Z',
        normalized: { service: 'api', host: 'inspur', level: 'error', message: 'failed', source_event_id: 'source-id',
            metadata: { category: 'request', tenantId: 'other-tenant' } },
    })
    expect(event).toEqual({ service: 'api', host: 'inspur', level: 'error', message: 'failed',
        metadata: { category: 'request', tenantId: 'other-tenant', source_event_id: 'source-id', organizationId: 'tenant-a' },
        sourceEventId: 'source-id', timestamp: '2026-10-22T12:00:00.000Z' })
})

test('migration normalizes missing or unsupported event fields without exposing source identifiers as content', () => {
    expect(logMigrationEvent({ id: 'stable-id', organization_id: 'platform', event_timestamp: new Date('2026-10-22T12:00:00Z'), normalized: {} }))
        .toEqual({ service: 'hanasand-api', host: '', level: 'info', message: '(empty)', metadata: { organizationId: 'platform' },
            sourceEventId: 'stable-id', timestamp: '2026-10-22T12:00:00.000Z' })
})

test('migration preserves structured top-level Hanasand event fields for Logs rules and projections', () => {
    const event = logMigrationEvent({
        id: 'event-row-id', organization_id: 'tenant-a', event_timestamp: '2026-10-22T12:00:00.000Z',
        normalized: {
            schema_version: 'logs.v1', source_vendor: 'Hanasand', source_product: 'Logs',
            event_type: 'process', action: 'exec', outcome: 'success', log_type: 'ProcessLogs',
            service: 'auditd', host: 'inspur', level: 'info', message: 'command completed',
            process: { executable: '/usr/bin/id', arguments: ['id', '-u'] },
            http: { path: '/internal', method: 'GET', status_code: 200 },
            user: { id: '1001', name: 'hanasand' }, source: { ip: '192.0.2.10' },
            device: { id: 'host-1' }, mongo: { command: 'find', database: 'app' }, severity: 'low',
            metadata: { category: 'audit', tenantId: 'tenant-a' }, source_event_id: 'source-id',
        },
    })

    expect(event.metadata).toMatchObject({
        schema_version: 'logs.v1', source_vendor: 'Hanasand', source_product: 'Logs',
        event_type: 'process', action: 'exec', outcome: 'success', log_type: 'ProcessLogs',
        process: { executable: '/usr/bin/id', arguments: ['id', '-u'] },
        http: { path: '/internal', method: 'GET', status_code: 200 },
        user: { id: '1001', name: 'hanasand' }, source: { ip: '192.0.2.10' },
        device: { id: 'host-1' }, mongo: { command: 'find', database: 'app' }, severity: 'low',
        category: 'audit', tenantId: 'tenant-a', source_event_id: 'source-id', organizationId: 'tenant-a',
    })
})

test('migration archives metadata and transport values changed by canonical projection', () => {
    const event = logMigrationEvent({
        id: 'event-row-id', organization_id: 'tenant-a', event_timestamp: '2026-10-22T12:00:00.000Z',
        normalized: {
            service: 'api'.repeat(140), host: 'inspur', level: 'warning', message: 'failed',
            action: 'exec', metadata: { action: 'legacy-action', organizationId: 'tenant-b', sourceHanasandMigrationOriginals: 'existing' },
        },
    })

    expect(event.service).toHaveLength(256)
    expect(event.level).toBe('warn')
    expect(event.metadata).toMatchObject({
        action: 'exec', organizationId: 'tenant-a', sourceHanasandMigrationOriginals: 'existing',
        _sourceHanasandMigrationOriginals: {
            metadata: { action: 'legacy-action', organizationId: 'tenant-b' },
            transport: { service: 'api'.repeat(140), level: 'warning' },
        },
    })
})
