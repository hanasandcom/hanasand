import { expect, test } from 'bun:test'
import {
    cleanContext,
    headerText,
    normalizeApprovalStatus,
    normalizeOption,
    normalizeSupportSessionActions,
    normalizeSupportSessionDuration,
    normalizeSupportSessionExpiry,
    normalizeSupportSessionScope,
    supportError,
    supportInspectionAuditContext,
    supportInspectionAuditMetadata,
    supportRequestId,
    supportSessionIdFromRequest,
    supportText,
} from '../src/utils/support/adminSupportInput.ts'
import type { FastifyRequest } from 'fastify'

function request(input: { id?: string, headers?: Record<string, string | string[] | undefined>, query?: Record<string, unknown> } = {}) {
    return {
        id: input.id || 'fastify-request',
        headers: input.headers || {},
        query: input.query || {},
    } as unknown as FastifyRequest
}

test('support session action and scope inputs retain their defaults and normalization', () => {
    expect(normalizeSupportSessionActions(undefined)).toEqual({
        value: ['invite_assist', 'invite_resend', 'invite_revoke', 'member_role_recovery'],
        error: null,
    })
    expect(normalizeSupportSessionActions(' INVITE_ASSIST, invite_assist, impersonation ')).toEqual({
        value: ['invite_assist', 'impersonation'],
        error: null,
    })
    expect(normalizeSupportSessionScope(undefined).value).toEqual([
        'invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery',
    ])
    expect(normalizeSupportSessionActions(['unknown']).error?.detail).toMatchObject({
        schemaVersion: 'support.error.v1',
        code: 'invalid_scope',
        outcome: 'denied',
    })
})

test('support session duration and expiry enforce existing bounds', () => {
    expect(normalizeSupportSessionDuration(undefined)).toEqual({ value: 60, error: null })
    expect(normalizeSupportSessionDuration('240')).toEqual({ value: 240, error: null })
    expect(normalizeSupportSessionDuration(4.5).error?.detail.code).toBe('invalid_duration')
    expect(normalizeSupportSessionDuration(241).error?.error).toBe('Support session duration must be between 5 and 240 minutes.')

    const tenMinutesFromNow = new Date(Date.now() + 10 * 60_000)
    expect(normalizeSupportSessionExpiry(tenMinutesFromNow.toISOString(), 60)).toEqual({ value: tenMinutesFromNow.toISOString(), error: null })
    expect(normalizeSupportSessionExpiry('not-a-date', 60).error?.detail.code).toBe('invalid_expiry')
    expect(normalizeSupportSessionExpiry(new Date(Date.now() + 5 * 60 * 60_000).toISOString(), 60).error?.error)
        .toBe('Support session expiry must be within 240 minutes.')
})

test('shared support errors retain the public envelope and extra fields', () => {
    expect(supportText('  support input  ')).toBe('support input')
    expect(supportText(42)).toBe('')
    expect(supportError('invalid_scope', 'Unsupported scope.', { allowed: ['read_org'] })).toEqual({
        error: 'Unsupported scope.',
        detail: {
            schemaVersion: 'support.error.v1',
            code: 'invalid_scope',
            outcome: 'denied',
            allowed: ['read_org'],
        },
    })
})

test('support request context keeps normalization and header precedence', () => {
    expect(cleanContext('  case\n  notes\twith   spacing  ')).toBe('case notes with spacing')
    expect(cleanContext(42)).toBe('')
    expect(cleanContext('x'.repeat(1001))).toHaveLength(1000)
    expect(headerText([' header value ', 'ignored'])).toBe('header value')
    expect(supportRequestId(request({ headers: { 'x-request-id': ['header-id', 'ignored'] } }))).toBe('header-id')
    expect(supportRequestId(request())).toBe('fastify-request')
    expect(supportSessionIdFromRequest(request({ headers: { 'x-support-session-id': 'header-session' } }), {
        supportSessionId: 'body-session',
    })).toBe('header-session')
    expect(supportSessionIdFromRequest(request(), { support_session_id: 'snake-session' })).toBe('snake-session')
})

test('support audit context prefers explicit request filters and retains its envelope', () => {
    const req = request({
        id: 'server-id',
        headers: { 'x-request-id': 'header-id' },
        query: { request: 'query-id', reason: 'inspection', context: '  case   notes  ' },
    })
    const metadata = supportInspectionAuditMetadata(req)
    expect(metadata).toEqual({ requestId: 'query-id', reason: 'inspection', supportContext: 'case notes' })
    expect(supportInspectionAuditContext(metadata, { source: 'support.inspect' })).toEqual({
        schemaVersion: 'support.inspection.audit_context.v1',
        requestId: 'query-id',
        reasonProvided: true,
        supportContext: 'case notes',
        redactionRequired: true,
        source: 'support.inspect',
    })
    expect(supportInspectionAuditMetadata(request())).toEqual({ requestId: 'fastify-request', reason: '', supportContext: '' })
})

test('support query values retain allowlists and approval status alias', () => {
    expect(normalizeOption(' WARNING ', ['info', 'warning'])).toBe('warning')
    expect(normalizeOption('critical', ['info', 'warning'])).toBe('')
    expect(normalizeApprovalStatus('PENDING_APPROVAL')).toBe('pending')
    expect(normalizeApprovalStatus('approved')).toBe('approved')
    expect(normalizeApprovalStatus('unknown')).toBe('')
})
