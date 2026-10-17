import { expect, test } from 'bun:test'
import type { FastifyRequest } from 'fastify'
// Share route mocks so Bun's wildcard run observes the same fixture spies everywhere.
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, resetAdminSupportDatabaseFixture } = support
const {
    postSupportOrganizationInvite,
    postSupportOrganizationInviteAction,
    postSupportOrganizationMemberRoleRecovery,
    supportInviteActionExecutorControls,
    supportInviteAssistExecutorControls,
    supportMemberRoleRecoveryExecutorControls,
} = await import('../src/handlers/adminSupport.ts')

function request(headers: Record<string, string | string[] | undefined> = {}) {
    return { headers } as unknown as FastifyRequest
}

async function invoke(handler: (req: any, res: any) => unknown, input: {
    params?: Record<string, string>
    body?: Record<string, unknown>
} = {}) {
    return support.request(handler, input)
}

test('support executor controls share header precedence and normalization', () => {
    const controls = supportInviteAssistExecutorControls(request({
        'x-idempotency-key': 'header key! ',
        'x-correlation-id': 'header-correlation',
        'x-support-session-id': 'header-session',
        'x-support-handoff-expires-at': '2030-01-01T00:00:00Z',
    }), {
        idempotencyKey: 'body-key',
        correlationId: 'body-correlation',
        supportSessionId: 'body-session',
        scope: 'invite:create',
    }, 'request-1')

    expect(controls.error).toBeNull()
    expect(controls.value).toMatchObject({
        schemaVersion: 'support.action_execute.controls.v1',
        requestId: 'request-1',
        correlationId: 'header-correlation',
        idempotencyKey: 'headerkey',
        supportSessionId: 'header-session',
        scope: ['invite:create'],
        handoffExpiresAt: '2030-01-01T00:00:00.000Z',
        staleBlocker: 'stale_prepare_payload',
        duplicateBlocker: 'duplicate_idempotency_key',
    })
})

test('support executor variants retain their required scopes and error wording', () => {
    const assist = supportInviteAssistExecutorControls(request(), { scope: 'invite:resend' }, 'req')
    expect(assist.error).toEqual({
        code: 'invalid_scope',
        message: 'Invite assistance execution requires invite:create scope.',
        status: 400,
    })

    const revoke = supportInviteActionExecutorControls(request(), { scope: 'invite:create' }, 'req', 'revoke')
    expect(revoke.error).toEqual({
        code: 'invalid_scope',
        message: 'Invite revoke execution requires invite:revoke scope.',
        status: 400,
    })

    const resend = supportInviteActionExecutorControls(request(), undefined, 'req', 'resend')
    expect(resend.error).toBeNull()
    expect(resend.value.scope).toEqual(['invite:resend'])

    const member = supportMemberRoleRecoveryExecutorControls(request(), { scope: 'invite:create' }, 'req')
    expect(member.error).toEqual({
        code: 'invalid_scope',
        message: 'Member role recovery execution requires member:role_recovery scope.',
        status: 400,
    })
})

test('support executor variants retain action-specific expiry errors', () => {
    const assist = supportInviteAssistExecutorControls(request(), {
        scope: 'invite:create',
        handoffExpiresAt: 'not-a-date',
    }, 'req')
    expect(assist.error).toEqual({
        code: 'invalid_expiry',
        message: 'Support invite assistance handoff expiry must be a valid timestamp.',
        status: 400,
    })

    const revoke = supportInviteActionExecutorControls(request(), {
        scope: 'invite:revoke',
        handoffExpiresAt: 'not-a-date',
    }, 'req', 'revoke')
    expect(revoke.error).toEqual({
        code: 'invalid_expiry',
        message: 'Support invite revoke handoff expiry must be a valid timestamp.',
        status: 400,
    })

    const member = supportMemberRoleRecoveryExecutorControls(request(), {
        handoffExpiresAt: '2000-01-01T00:00:00Z',
    }, 'req')
    expect(member.error).toEqual({
        code: 'stale_prepare_payload',
        message: 'Member role recovery handoff has expired; prepare a fresh action before executing.',
        status: 409,
    })
})

test('executor audit replay URLs preserve parameter order, encoding, and action-specific empty fields', async () => {
    resetAdminSupportDatabaseFixture()
    state.supportOrganization = { id: 'org-1', name: 'Org', slug: 'org', status: 'active' }
    state.supportRecoveryInviteUpsert = {
        id: '', organization_id: 'org-1', email: 'member@example.com', role: 'reader', status: 'pending',
        expires_at: '2030-01-01T00:00:00.000Z', accepted_at: null, accepted_by: null, revoked_at: null,
        invited_by: 'support-admin', created_at: '2026-10-16T00:00:00.000Z',
    }

    const assistance = await invoke(postSupportOrganizationInvite, {
        params: { id: 'org-1' },
        body: {
            emails: ['member@example.com'], role: 'reader', reason: 'review / & retry',
            requestId: 'assist-1', correlationId: 'corr /&', idempotencyKey: 'assist-key',
        },
    })
    expect(assistance.statusCode).toBe(201)
    expect(assistance.body.inviteAssistance.audit.query).toBe(
        '/api/admin/audit-events?request=assist-1&correlation=corr+%2F%26&idempotency=assist-key&org=org-1&reason=review+%2F+%26+retry&action=support.organization.invite_assist&outcome=success&source=admin&service=hanasand-api',
    )

    const inviteAction = await invoke(postSupportOrganizationInviteAction, {
        params: { id: 'org-1', inviteId: '' },
        body: { action: 'revoke', reason: 'review action', scope: 'invite:create', requestId: 'action-1' },
    })
    expect(inviteAction.statusCode).toBe(400)
    expect(inviteAction.body.detail.executionReceipt.audit.replay).toBe(
        '/api/admin/audit-events?request=action-1&correlation=action-1&idempotency=action-1&org=org-1&entity=&reason=review+action&action=support.organization.invite_revoke&outcome=denied&source=admin&service=hanasand-api',
    )

    const memberRecovery = await invoke(postSupportOrganizationMemberRoleRecovery, {
        params: { id: 'org-1', userId: '' },
        body: { role: 'reader', reason: 'review member', scope: 'invite:create', requestId: 'member-1' },
    })
    expect(memberRecovery.statusCode).toBe(400)
    expect(memberRecovery.body.detail.executorBlocker.memberRecoveryHandoff.expectedAuditEventLookup).toBe(
        '/api/admin/audit-events?request=member-1&correlation=member-1&idempotency=member-1&org=org-1&entity=&target=&reason=review+member&action=support.organization.member_role_recovery&outcome=denied&source=admin&service=hanasand-api',
    )
})
