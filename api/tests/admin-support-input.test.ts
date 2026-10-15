import { expect, test } from 'bun:test'
import {
    normalizeSupportSessionActions,
    normalizeSupportSessionDuration,
    normalizeSupportSessionExpiry,
    normalizeSupportSessionScope,
    supportError,
    supportText,
} from '../src/utils/support/adminSupportInput.ts'

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
