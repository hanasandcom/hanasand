import { expect, test } from 'bun:test'
import {
    cleanContext,
    headerText,
    normalizeApprovalStatus,
    normalizeOption,
    supportError,
    supportInspectionAuditContext,
    supportInspectionAuditMetadata,
    supportInspectionQueryFilters,
    supportRequestId,
    supportSessionIdFromRequest,
    supportSessionIdFromAuditEvent,
    supportText,
} from '../src/utils/support/adminSupportInput.ts'
import {
    normalizeSupportPreparationDuration,
    normalizeSupportPreparationExpiry,
    normalizeSupportPreparationScope,
    normalizeSupportSessionActions,
    normalizeSupportSessionDuration,
    normalizeSupportSessionExpiry,
    normalizeSupportSessionScope,
} from '../src/utils/support/adminSupportSessionInput.ts'
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
    expect(normalizeSupportSessionScope(' INVITE:CREATE, invite:create ').value).toEqual(['invite:create'])
    expect(normalizeSupportSessionActions(['unknown']).error?.detail).toMatchObject({
        schemaVersion: 'support.error.v1',
        code: 'invalid_scope',
        outcome: 'denied',
    })
    expect(normalizeSupportSessionScope(['unknown']).error?.detail).toMatchObject({
        schemaVersion: 'support.error.v1',
        code: 'invalid_scope',
        supportedScopes: ['invite:create', 'invite:resend', 'invite:revoke', 'member:role_recovery', 'recovery:invite', 'recovery:approve', 'recovery:deny', 'read_profile', 'read_org', 'support_debug'],
    })
})

test('audit event support-session identity uses explicit support IDs or tagged entities only', () => {
    expect(supportSessionIdFromAuditEvent({ context: { supportSessionId: '  scoped-session  ' }, entityId: 'support_session_entity' }))
        .toBe('scoped-session')
    expect(supportSessionIdFromAuditEvent({ context: {}, entityId: 'support_session_entity' })).toBe('support_session_entity')
    expect(supportSessionIdFromAuditEvent({ context: { sessionId: 'impersonation-session' }, entityId: 'impersonation-session' })).toBe('')
    expect(supportSessionIdFromAuditEvent({ context: null, entityId: null })).toBe('')
})

test('support preparation scope keeps action-specific defaults, allowlists, and errors', () => {
    expect(normalizeSupportPreparationScope(undefined, 'access_recovery').error?.detail).toMatchObject({
        code: 'missing_scope',
        supportedScopes: ['recovery:invite', 'recovery:approve', 'recovery:deny'],
    })
    expect(normalizeSupportPreparationScope(' RECOVERY:INVITE, recovery:invite, recovery:deny ', 'access_recovery')).toEqual({
        value: ['recovery:invite', 'recovery:deny'],
        error: null,
    })
    expect(normalizeSupportPreparationScope('invite:create', 'access_recovery').error?.detail).toMatchObject({
        code: 'invalid_scope',
        supportedScopes: ['recovery:invite', 'recovery:approve', 'recovery:deny'],
    })
    expect(normalizeSupportPreparationScope('read_profile', 'unknown').error?.detail).toMatchObject({
        code: 'invalid_scope',
        supportedScopes: [],
    })
})

test('support session duration and expiry enforce existing bounds', () => {
    expect(normalizeSupportSessionDuration(undefined)).toEqual({ value: 60, error: null })
    expect(normalizeSupportSessionDuration(5)).toEqual({ value: 5, error: null })
    expect(normalizeSupportSessionDuration('240')).toEqual({ value: 240, error: null })
    expect(normalizeSupportSessionDuration(4.5).error?.detail.code).toBe('invalid_duration')
    expect(normalizeSupportSessionDuration(241).error?.error).toBe('Support session duration must be between 5 and 240 minutes.')

    const tenMinutesFromNow = new Date(Date.now() + 10 * 60_000)
    expect(normalizeSupportSessionExpiry(tenMinutesFromNow.toISOString(), 60)).toEqual({ value: tenMinutesFromNow.toISOString(), error: null })
    expect(normalizeSupportSessionExpiry('not-a-date', 60).error?.detail.code).toBe('invalid_expiry')
    expect(normalizeSupportSessionExpiry(new Date(Date.now() + 5 * 60 * 60_000).toISOString(), 60).error?.error)
        .toBe('Support session expiry must be within 240 minutes.')
    const expiryBeforeDefault = Date.now()
    const defaultExpiry = Date.parse(normalizeSupportSessionExpiry(undefined, 30).value)
    expect(defaultExpiry).toBeGreaterThanOrEqual(expiryBeforeDefault + 30 * 60_000)
    expect(defaultExpiry).toBeLessThanOrEqual(Date.now() + 30 * 60_000)
    const longerThanDuration = new Date(Date.now() + 90 * 60_000)
    expect(normalizeSupportSessionExpiry(longerThanDuration.toISOString(), 5)).toEqual({ value: longerThanDuration.toISOString(), error: null })
})

test('support preparation duration and expiry retain their distinct requirements', () => {
    expect(normalizeSupportPreparationDuration(undefined, 'invite_assist')).toEqual({ value: null, error: null })
    expect(normalizeSupportPreparationDuration(undefined, 'impersonation').error?.error)
        .toBe('Impersonation preparation duration is required.')
    expect(normalizeSupportPreparationDuration(5, 'impersonation')).toEqual({ value: 5, error: null })
    expect(normalizeSupportPreparationDuration('240', 'impersonation')).toEqual({ value: 240, error: null })
    expect(normalizeSupportPreparationDuration(4, 'impersonation').error?.error)
        .toBe('Impersonation preparation duration must be between 5 and 240 minutes.')
    expect(normalizeSupportPreparationDuration(241, 'impersonation').error?.detail.code).toBe('invalid_duration')

    expect(normalizeSupportPreparationExpiry(undefined)).toEqual({ value: null, error: null })
    expect(normalizeSupportPreparationExpiry('')).toEqual({ value: null, error: null })
    expect(normalizeSupportPreparationExpiry('not-a-date').error?.detail.code).toBe('invalid_expiry')
    expect(normalizeSupportPreparationExpiry(new Date(Date.now() - 60_000).toISOString()).error?.detail.code).toBe('invalid_expiry')
    const beyondSessionLimit = new Date(Date.now() + 5 * 60 * 60_000)
    expect(normalizeSupportPreparationExpiry(beyondSessionLimit.toISOString())).toEqual({ value: beyondSessionLimit.toISOString(), error: null })
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

test('support inspection filters preserve aliases and endpoint-specific defaults and limits', () => {
    expect(supportInspectionQueryFilters({
        orgId: ' org-1 ', userId: ' user-1 ', supportSessionId: ' session-1 ',
        bridgeWorkflow: ' Invite ', supportReason: ' case ', supportScope: ' org ',
        supportContext: ' note ', severity: ' WARNING ', outcome: ' FAILED ', limit: '200',
    })).toMatchObject({
        org: 'org-1', user: 'user-1', supportSession: 'session-1', workflow: 'Invite',
        reason: 'case', scope: 'org', context: 'note', severity: 'warning', outcome: 'failed', limit: 100,
        action: '', source: '', service: '',
    })
    expect(supportInspectionQueryFilters({ org: 'org-1' }, {
        action: 'support', source: 'system', service: 'hanasand-api', limit: 25, maxLimit: 50,
    })).toMatchObject({ action: 'support', source: 'system', service: 'hanasand-api', limit: 25 })
    expect(supportInspectionQueryFilters({ org: 'org-1', limit: '200' }, { limit: 25, maxLimit: 50 }).limit).toBe(50)
})
