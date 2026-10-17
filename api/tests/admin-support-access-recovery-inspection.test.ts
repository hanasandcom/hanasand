import { beforeEach, expect, test } from 'bun:test'
import { accessRecoveryApprovalFixture, getSupportAccessRecoveryApproval, request, resetAdminSupportDatabaseFixture, state } from './fixtures/admin-support-routes-harness.ts'

beforeEach(() => resetAdminSupportDatabaseFixture())

test('access recovery inspection joins audit actors and returns its event timeline', async () => {
    state.supportDecisionApproval = { ...accessRecoveryApprovalFixture('approval-1'), target_user_id: null }
    state.eventRows = [{
        id: 77, event_type: 'support.organization.access_recovery', severity: 'info', source: 'admin', service: 'hanasand-api',
        actor_id: 'support-admin', actor_name: 'Support Admin', object_type: 'access_recovery', object_id: 'invite-1',
        target_name: null, organization_id: 'org-1', organization_name: 'Org', subject_id: 'invite-1',
        request_id: 'approval-1', outcome: 'success', reason: 'Restore access', context: {},
        created_at: '2026-10-16T00:00:00.000Z',
    }]

    const result = await request(getSupportAccessRecoveryApproval, { params: { requestId: 'approval-1' } })

    expect(result.statusCode).toBe(200)
    expect(result.body.accessRecoveryInspection.auditEventIds).toEqual([77])
    const query = state.queries.find(({ sql }) => sql.includes('FROM system_events event'))
    expect(query?.sql).toContain('LEFT JOIN users actor ON actor.id = event.actor_id')
})
