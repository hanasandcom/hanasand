import { expect, test } from 'bun:test'
import { redactAuditValue, supportTimelineAuditBridgeEvent } from '../src/utils/systemEvent.ts'

test('support timeline bridge preserves normalized event fields, filters, and redacted evidence', () => {
    const event = supportTimelineAuditBridgeEvent({
        workflow: 'watchlist',
        action: 'alert readiness inspect',
        actorId: ' actor-1 ',
        targetType: 'organization member',
        targetId: ' target-1 ',
        organizationId: ' org-1 ',
        entityId: '',
        requestId: ' request-1 ',
        correlationId: ' correlation-1 ',
        idempotencyKey: ' key-1 ',
        reason: '  reviewed\nalert readiness  ',
        scope: { api_key: 'secret-value', grants: ['read'] },
        before: { privateUrl: 'https://private.example' },
        after: { status: 'ready' },
    })

    expect(event).toMatchObject({
        actionType: 'watchlist.alert_readiness_inspect',
        actorId: 'actor-1',
        targetType: 'organization-member',
        targetId: 'target-1',
        organizationId: 'org-1',
        entityId: 'target-1',
        requestId: 'request-1',
        reason: 'reviewed alert readiness',
        source: 'watchlist',
        service: 'hanasand-api',
        context: {
            schemaVersion: 'support.audit.bridge_event.v1',
            action: 'alert_readiness_inspect',
            correlationId: 'correlation-1',
            idempotencyKey: 'key-1',
            scope: { api_key: '[redacted]', grants: ['read'] },
            before: { privateUrl: '[redacted]' },
            after: { status: 'ready' },
            supportTimeline: {
                schemaVersion: 'support.audit.timeline_adapter.v1',
                filters: {
                    org: 'org-1',
                    actor: 'actor-1',
                    target: 'target-1',
                    action: 'watchlist.alert_readiness_inspect',
                    entity: 'target-1',
                    request: 'request-1',
                    outcome: 'success',
                    severity: 'info',
                },
                redactionRequired: true,
            },
        },
    })
    expect(redactAuditValue([{ credential: 'private', note: 'visible' }])).toEqual([
        { credential: '[redacted]', note: 'visible' },
    ])
})
