import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import ingestLog from '../../src/handlers/logs/ingest.ts'
import { queryOnce } from '../../src/utils/db.ts'
import ensureSchema from '../../src/utils/db/ensureSchema.ts'
import recordLog from '../../src/utils/logs/recordLog.ts'
import {
    exportOrganizationPrivacyData,
    organizationPrivacyState,
    queueOrganizationRetentionRun,
    runOrganizationRetentionWorker,
} from '../../src/utils/organizationPrivacy.ts'

export async function verifyRetentionDeletion({ users, runA, app }: {
    users: string[]
    runA: { id: string }
    app: FastifyInstance
}) {
    await queryOnce('INSERT INTO organization_privacy_requests (id, organization_id, request_type, requested_by, request_id) VALUES (\'privacy_delete_c\', \'retention_org_c\', \'deletion\', $1, $2)', [users[2], randomUUID()])
    const adminAuditId = (await queryOnce(`
    INSERT INTO admin_audit_events (
        action_type, severity, source, service, actor_id, target_type, target_id,
        organization_id, entity_id, request_id, outcome, reason, context, ip, user_agent
    ) VALUES (
        'retention.raw-audit', 'notice', 'admin', 'hanasand-api', $1, 'customer',
        'raw-target@example.test', 'retention_org_c', 'raw-entity@example.test',
        'raw-request@example.test', 'success', 'raw customer reason',
        '{"rawCustomer":"sensitive audit context"}'::jsonb, '203.0.113.42', 'raw-customer-agent'
    ) RETURNING id
`, [users[2]])).rows[0].id
    await queryOnce(`
    INSERT INTO dwm_webhook_audit_events (id, owner_id, actor_id, org_id, action, metadata)
    VALUES ('audit_delete_c', $1, $1, 'retention_org_c', 'retention.raw-webhook', '{"rawCustomer":"sensitive webhook context"}'::jsonb)
`, [users[2]])
    const unscopedLogIds = [await recordLog({
        service: 'secret-http-service', host: 'secret-http-host', level: 'error', message: 'secret HTTP response body',
        metadata: {
            category: 'http_response_error', surface: 'organizations', method: 'DELETE',
            path: '/api/organizations/retention_org_c/privacy?secret=unscoped-http-marker',
            request_id: 'unscoped-http-request-marker', user_id: 'unscoped-http-user-marker',
            ip: '203.0.113.44', user_agent: 'unscoped-http-agent-marker', referer: 'https://secret.example/customer',
            error_message: 'unscoped-http-error-marker', body: 'unscoped-http-body-marker',
        },
    }), await recordLog({
        service: 'secret-onerror-service', host: 'secret-onerror-host', level: 'error', message: 'unscoped-onerror-message-marker',
        metadata: {
            method: 'POST', url: '/api/admin/support/organizations/retention_org_c?secret=unscoped-onerror-url-marker',
            error: 'unscoped-onerror-error-marker', stack: 'unscoped-onerror-stack-marker',
        },
    })]
    const unscopedLogs = (await queryOnce(`SELECT normalized->>'service' service, normalized->>'host' host, normalized->>'level' level,
    normalized->>'message' message, normalized->'metadata' metadata FROM events WHERE id=ANY($1::text[])
    AND normalized->>'message'='organization_request_error' ORDER BY received_at`, [unscopedLogIds])).rows
    assert.deepEqual(unscopedLogs, [
        { service: 'hanasand-api', host: '', level: 'error', message: 'organization_request_error', metadata: { category: 'organization_request_error', surface: 'organizations' } },
        { service: 'hanasand-api', host: '', level: 'error', message: 'organization_request_error', metadata: { category: 'organization_request_error', surface: 'organizations' } },
    ])
    const beforeDeleteIngest = await app.inject({
        method: 'POST', url: '/api/logs/ingest', headers: { authorization: `Bearer ${process.env.VM_API_TOKEN}` },
        payload: {
            service: 'internal-ingest-service-marker', host: 'raw-customer-host', level: 'fatal', message: 'internal-ingest-message-marker',
            metadata: {
                category: 'organization_privacy', action: 'delete', organizationId: 'retention_org_c', tenantId: 'retention_org_c',
                actorId: users[2], requestId: 'raw-service-request@example.test', outcome: 'failed',
                error: 'raw service customer context from 203.0.113.43', body: 'internal-ingest-body-marker',
            },
        },
    })
    assert.equal(beforeDeleteIngest.statusCode, 201, beforeDeleteIngest.body)
    const beforeDeleteServiceLog = (await queryOnce(`SELECT id, normalized->>'service' service, normalized->>'host' host, normalized->>'level' level,
    normalized->>'message' message, normalized->'metadata' metadata FROM events
    WHERE normalized->>'service'='internal-ingest-service-marker' ORDER BY received_at DESC LIMIT 1`)).rows[0]
    assert.equal(JSON.stringify(beforeDeleteServiceLog).includes('internal-ingest-message-marker'), true)
    assert.equal(JSON.stringify(beforeDeleteServiceLog).includes('raw-service-request@example.test'), true)
    const serviceLogId = beforeDeleteServiceLog.id
    const deletion = await queueOrganizationRetentionRun({ organizationId: 'retention_org_c', triggerType: 'privacy_deletion', requestedBy: users[2], requestId: randomUUID(), privacyRequestId: 'privacy_delete_c', retentionDays: 30 })
    await queryOnce('INSERT INTO dwm_webhook_deliveries (id, owner_id, org_id, alert_id, event_type, status, dry_run, payload, idempotency_key, created_at, updated_at) VALUES (\'delivery_delete_after_cutoff\', $1, \'retention_org_c\', \'alert_after_cutoff\', \'dwm.alert.created\', \'failed\', false, \'{"secret":"newer customer payload"}\', \'delivery-delete-after-cutoff\', NOW() + INTERVAL \'1 minute\', NOW() + INTERVAL \'1 minute\')', [users[2]])
    assert.equal((await runOrganizationRetentionWorker(deletion.id)).failed, false)
    const tombstone = (await queryOnce('SELECT * FROM organizations WHERE id = \'retention_org_c\'')).rows[0]
    assert.equal(tombstone.status, 'deleted')
    assert.equal(tombstone.name, 'Deleted organization')
    assert.equal(tombstone.slug, 'deleted-retention_org_c')
    assert.equal(tombstone.created_by, null)
    assert.equal(tombstone.default_webhook_policy, 'disabled')
    assert.equal(tombstone.retention_days, 30)
    assert.equal(tombstone.audit_safe_metadata.privacyDeletionRunId, deletion.id)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_c\'')).rows[0].count, 0)
    assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_delete_after_cutoff\'')).rows[0].payload, {})
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_b\' AND status = \'active\'')).rows[0].count, 1)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_delete_hold\'')).rows[0].count, 1)
    assert.equal((await queryOnce('SELECT status FROM organization_privacy_requests WHERE id = \'privacy_delete_c\'')).rows[0].status, 'completed')
    assert.equal((await queryOnce('SELECT protected_count FROM organization_retention_runs WHERE id = $1', [deletion.id])).rows[0].protected_count > 0, true)
    const redactedAdminAudit = (await queryOnce('SELECT action_type, actor_id, target_id, entity_id, request_id, outcome, reason, context, ip, user_agent FROM admin_audit_events WHERE id = $1', [adminAuditId])).rows[0]
    assert.deepEqual(redactedAdminAudit, {
        action_type: 'retention.raw-audit', actor_id: null, target_id: null, entity_id: null, request_id: null,
        outcome: 'success', reason: '', context: { privacyDeletionRunId: deletion.id }, ip: '', user_agent: '',
    })
    const redactedWebhookAudit = (await queryOnce('SELECT action, owner_id, actor_id, metadata FROM dwm_webhook_audit_events WHERE id = \'audit_delete_c\'')).rows[0]
    assert.deepEqual(redactedWebhookAudit, { action: 'retention.raw-webhook', owner_id: null, actor_id: null, metadata: { privacyDeletionRunId: deletion.id } })
    const redactedServiceLog = (await queryOnce(`SELECT normalized->>'service' service, normalized->>'host' host, normalized->>'level' level,
    normalized->>'message' message, normalized->'metadata' metadata FROM events WHERE id = $1`, [serviceLogId])).rows[0]
    assert.deepEqual(redactedServiceLog, {
        service: 'hanasand-api', host: '', level: 'info', message: 'delete',
        metadata: { category: 'organization_privacy', action: 'delete', organizationId: 'retention_org_c', tenantId: 'retention_org_c', outcome: 'failed', privacyDeletionRunId: deletion.id },
    })

    await app.close()
    await ensureSchema()
    const restartedApp = Fastify({ logger: false })
    restartedApp.post('/api/logs/ingest', ingestLog)
    await restartedApp.ready()
    const postDeleteIngest = await restartedApp.inject({
        method: 'POST', url: '/api/logs/ingest', headers: { authorization: `Bearer ${process.env.VM_API_TOKEN}` },
        payload: {
            service: 'post-delete-service-marker', host: 'post-delete-host-marker', level: 'fatal', message: 'post-delete-message-marker',
            metadata: {
                category: 'post-delete-category-marker', action: 'post-delete-action-marker',
                organizationId: 'retention_org_c', tenantId: 'retention_org_c', outcome: 'post-delete-outcome-marker',
                requestId: 'post-delete-request-marker', error: 'post-delete-error-marker', body: 'post-delete-body-marker',
            },
        },
    })
    assert.equal(postDeleteIngest.statusCode, 201, postDeleteIngest.body)
    const postDeleteServiceLog = (await queryOnce(`SELECT id, normalized->>'service' service, normalized->>'host' host,
    normalized->>'level' level, normalized->>'message' message, normalized->'metadata' metadata FROM events
    WHERE normalized #>> '{metadata,privacyDeletionRunId}'=$1 AND normalized #>> '{metadata,action}'='post_delete_event'
    ORDER BY received_at DESC LIMIT 1`, [deletion.id])).rows[0]
    assert.deepEqual(postDeleteServiceLog, {
        id: postDeleteServiceLog.id,
        service: 'hanasand-api', host: '', level: 'info', message: 'organization_event',
        metadata: {
            category: 'organization_privacy', action: 'post_delete_event', organizationId: 'retention_org_c', tenantId: 'retention_org_c',
            outcome: 'recorded', privacyDeletionRunId: deletion.id,
        },
    })
    await restartedApp.close()

    const postDeleteExport = await exportOrganizationPrivacyData('retention_org_c')
    assert.equal((postDeleteExport.data.public.organization as { name: string }).name, 'Deleted organization')
    assert.equal((postDeleteExport.data.public.organization as { created_by: string | null }).created_by, null)
    assert.deepEqual(postDeleteExport.data.public.members, [])
    assert.equal((postDeleteExport.data.public.invites as Array<{ id: string }>).some(invite => invite.id === 'invite_delete_hold'), true)
    assert.equal(JSON.stringify(postDeleteExport).includes('Sensitive Customer C'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('sensitive-customer-c'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('raw customer reason'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('sensitive audit context'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('sensitive webhook context'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('203.0.113.42'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('raw-customer-host'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('raw-service-request@example.test'), false)
    assert.equal(JSON.stringify(postDeleteExport).includes('203.0.113.43'), false)
    const retainedServiceLogs = JSON.stringify((await queryOnce(`SELECT normalized->>'service' service, normalized->>'host' host,
    normalized->>'message' message, normalized->'metadata' metadata FROM events
    WHERE id=ANY($1::text[]) OR id=$2`, [[...unscopedLogIds, postDeleteServiceLog.id], postDeleteServiceLog.id])).rows)
    for (const marker of ['internal-ingest', 'unscoped-http', 'unscoped-onerror', 'post-delete-', 'secret-http', 'secret-onerror', 'secret HTTP', 'raw service customer context', 'raw-service-request', '203.0.113.43']) {
        assert.equal(JSON.stringify(postDeleteExport).includes(marker), false)
        assert.equal(retainedServiceLogs.includes(marker), false)
    }
    assert.equal((postDeleteExport.data.public.events as Array<{ id: string }>).some(log => String(log.id) === String(serviceLogId)), true)
    assert.equal((postDeleteExport.data.public.events as Array<{ id: string }>).some(log => String(log.id) === String(postDeleteServiceLog.id)), true)
    const postDeleteState = await organizationPrivacyState('retention_org_c')
    assert.equal(postDeleteState.protection.immutable_log_events, 2)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'event\' AND status = \'redacted\'', [deletion.id])).rows[0].count, 1)

    const counts = (await queryOnce('SELECT selected_count, protected_count, deleted_count, redacted_count, failed_count, retried_count FROM organization_retention_runs WHERE id = $1', [runA.id])).rows[0]
    assert.equal(counts.selected_count, counts.protected_count + counts.deleted_count + counts.redacted_count + counts.failed_count + counts.retried_count)
}
