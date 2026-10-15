import { expect, test } from 'bun:test'
import type { FastifyRequest } from 'fastify'
import {
    supportInviteActionExecutorControls,
    supportInviteAssistExecutorControls,
    supportMemberRoleRecoveryExecutorControls,
} from '../src/handlers/adminSupport.ts'

function request(headers: Record<string, string | string[] | undefined> = {}) {
    return { headers } as unknown as FastifyRequest
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
