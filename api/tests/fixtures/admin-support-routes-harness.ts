import { expect, mock } from 'bun:test'
import { resetAdminSupportDatabaseFixture, run, state } from './admin-support-routes-db.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

export { resetAdminSupportDatabaseFixture, run, state }

export function accessRecoveryApprovalFixture(requestId: string) {
    return {
        request_id: requestId, organization_id: 'org-1', invite_id: 'invite-1', target_user_id: 'user-1',
        requested_by: 'requester', requested_reason: 'Restore account access', request_context: '', approval_required: true,
        status: 'pending', approved_by: null, approved_at: null, denied_by: null, denied_at: null, decision_reason: null,
        outcome: 'success', expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z', email: 'member@example.com', role: 'reader', invite_status: 'revoked', organization_name: 'Org',
    }
}

export function supportRecoveryInviteFixture(overrides: Record<string, unknown> = {}) {
    return {
        id: 'recovery-invite-1', organization_id: 'org-1', email: 'owner@example.test', role: 'admin',
        status: 'pending', expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null,
        revoked_at: null, invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
        ...overrides,
    }
}

mock.module('../../src/utils/db.ts', () => ({ default: run, queryOnce: run, identityQueryOnce: run, withTransaction: async (work: (query: typeof run) => Promise<unknown>) => work(run), closeDatabase: async () => {} }))
const systemEventUtils = await import('../../src/utils/systemEvent.ts')
const identityDataWrites = await import('../../src/utils/db/identityDataWrites.ts')
export const organizationInviteUpsertCalls: Array<Record<string, unknown>> = []
mock.module('../../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => state.actor }))
mock.module('../../src/utils/systemEvent.ts', () => ({
    ...systemEventUtils,
    actorHasHanasandInternalAccess: async () => state.internalAccess,
    recordSystemEvent: async (_req: unknown, event: Record<string, unknown>) => {
        state.recordedEvents.push(event)
        if (['support.session.create', 'support.session.revoke', 'support.session.inspect'].includes(String(event.actionType))) {
            state.supportSessionEvents.push({
                id: state.nextSupportEventId++,
                event_type: event.actionType,
                severity: event.severity,
                source: 'admin',
                service: 'hanasand-api',
                actor_id: event.actorId,
                object_type: event.targetType,
                object_id: event.targetId,
                organization_id: event.organizationId,
                subject_id: event.entityId,
                request_id: event.requestId,
                outcome: event.outcome,
                reason: event.reason,
                context: event.context,
                created_at: new Date().toISOString(),
            })
        }
    },
}))
mock.module('../../src/utils/db/identityDataWrites.ts', () => ({
    upsertAdminAccessRecoveryApproval: async () => { state.supportRecoveryApprovalWrites += 1 },
    upsertOrganizationInvite: async (input: Record<string, unknown>) => {
        organizationInviteUpsertCalls.push(input)
        return state.supportRecoveryInviteUpsert
    },
    updateOrganizationInviteAction: async (input: Record<string, unknown>) => {
        state.inviteActionWrites += 1
        state.inviteActionInputs.push(input)
        return state.supportRecoveryInviteResult
    },
    updateActiveOrganizationMemberRole: identityDataWrites.updateActiveOrganizationMemberRole,
}))

export const {
    getSystemEvents,
    getSystemEvent,
    getSupportAccessRecoveryApprovals,
    getSupportInspection,
    getSupportReadiness,
    getSupportOrganization,
    getSupportUser,
    getSupportOrganizationInvite,
    getSupportOrganizationMember,
    postSupportOrganizationInvite,
    postSupportOrganizationInviteAction,
    postSupportOrganizationMemberRoleRecovery,
    postSupportSession,
    getSupportSession,
    postSupportSessionRevoke,
    postSupportAccessRecovery,
    postSupportAccessRecoveryApprove,
    postSupportAccessRecoveryDeny,
} = await import('../../src/handlers/adminSupport.ts')

function reply() {
    return {
        statusCode: 200,
        body: undefined as any,
        header() { return this },
        status(code: number) { this.statusCode = code; return this },
        send(body: unknown) { this.body = body; return this },
    }
}

export async function request(handler: (req: any, res: any) => unknown, input: {
    query?: Record<string, string>, params?: Record<string, string>, body?: Record<string, unknown>, headers?: Record<string, string>
} = {}) {
    const result = reply()
    await handler({ query: input.query ?? {}, params: input.params ?? {}, headers: input.headers ?? {}, body: input.body ?? {} } as FastifyRequest, result as unknown as FastifyReply)
    return result
}

export function activeSupportOrganizationFixture() {
    return { id: 'org-1', name: 'Org', slug: 'org', status: 'active' }
}

export function supportInviteInspectionFixture() {
    return {
        id: 'invite-1', organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org',
        email: 'member@example.com', role: 'reader', status: 'pending', invited_by: 'owner-1',
        expires_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-01T00:00:00.000Z',
        accepted_at: null, accepted_by: null, revoked_at: null,
    }
}

export function supportMemberInspectionFixture() {
    return {
        organization_id: 'org-1', organization_name: 'Org', organization_slug: 'org', user_id: 'member-1',
        name: 'Member', avatar: null, active: true, deactivated_at: null, deletion_scheduled_at: null,
        role: 'editor', status: 'active', invited_by: 'owner-1', joined_at: '2026-10-01T00:00:00.000Z',
        created_at: '2026-10-01T00:00:00.000Z',
    }
}

export function supportInspectionAuditFixture(entityId: string) {
    return {
        id: 71, event_type: 'support.organization.inspect', severity: 'info', source: 'admin', service: 'hanasand-api',
        actor_id: 'support-admin', actor_name: 'Support Admin', object_type: 'organization', object_id: entityId,
        organization_id: 'org-1', organization_name: 'Org', subject_id: entityId, request_id: 'prior-request',
        outcome: 'success', reason: 'Inspection event', context: {}, created_at: '2026-10-16T00:00:00.000Z',
    }
}

export function expectInspectionAuditQuery(entityId: string, targetPredicates: string[]) {
    const auditQuery = state.queries.find(({ sql }) => sql.includes('FROM system_events event') && sql.includes('event.organization_id = $1'))
    expect(auditQuery).toBeDefined()
    expect(auditQuery?.sql).toContain('event.organization_id = $1')
    expect(auditQuery?.sql).toContain('event.subject_id = $2')
    for (const predicate of targetPredicates) expect(auditQuery?.sql).toContain(predicate)
    expect(auditQuery?.values).toEqual(['org-1', entityId])
}

