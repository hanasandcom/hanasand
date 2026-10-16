import { beforeEach, expect, test } from 'bun:test'
import * as support from './fixtures/admin-support-routes-harness.ts'

const { state, request, getSupportOrganization, getSupportUser, activeSupportOrganizationFixture } = support

beforeEach(() => {
    support.resetAdminSupportDatabaseFixture()
    support.organizationInviteUpsertCalls.length = 0
})

test('organization and user activity rollups share the filtered audit summary', async () => {
    state.supportOrganization = activeSupportOrganizationFixture()
    state.supportUser = {
        id: 'user-1', name: 'User One', avatar: null, active: true, reserved: false,
        deactivated_at: null, deactivated_by: null, deletion_requested_at: null, deletion_scheduled_at: null,
    }
    const event = (id: number | string, event_type: string, request_id: string | null, outcome: string, context: Record<string, unknown> = {}) => ({
        id, event_type, severity: 'notice', source: 'admin', service: 'hanasand-api', actor_id: 'support-admin',
        object_type: 'organization', object_id: 'org-1', organization_id: 'org-1', subject_id: `entity-${id}`,
        request_id, outcome, reason: 'Support audit reason', context, created_at: '2026-10-16T00:00:00.000Z',
    })
    state.eventRows = [
        event(71, 'support.organization.invite_assist', 'rollup-request-1', 'denied', {
            scope: ['invite:create'], expiresAt: '2026-11-01T00:00:00.000Z',
            blockerCode: 'invite_guard', blocker: 'manual_block',
        }),
        event(72, 'support.session.inspect', 'rollup-request-2', 'success'),
        event('not-numeric', 'support.session.inspect', 'rollup-request-2', 'success'),
        event(73, 'organization.member.role_updated', 'other-request', 'denied'),
    ]

    const organizationResponse = await request(getSupportOrganization, { params: { id: 'org-1' } })
    const userResponse = await request(getSupportUser, { params: { id: 'user-1' } })
    expect(organizationResponse.statusCode).toBe(200)
    expect(userResponse.statusCode).toBe(200)
    const organizationRollup = organizationResponse.body.supportActivityRollup
    const userRollup = userResponse.body.supportActivityRollup
    expect(Object.keys(organizationRollup)).toEqual([
        'schemaVersion', 'generatedAt', 'organizationId', 'requestId', 'eventCount', 'eventIds', 'actionCounts',
        'outcomes', 'severities', 'requestIds', 'actorIds', 'targetIds', 'blockerCodes', 'links', 'guardrails',
        'redacted', 'copyText',
    ])
    expect(Object.keys(userRollup)).toEqual([
        'schemaVersion', 'generatedAt', 'userId', 'organizationIds', 'requestId', 'eventCount', 'eventIds',
        'actionCounts', 'outcomes', 'requestIds', 'organizationTimelineLinks', 'links', 'guardrails', 'blockerCodes',
        'redacted', 'copyText',
    ])
    const sharedSummary = (rollup: Record<string, any>) => ({
        eventCount: rollup.eventCount,
        eventIds: rollup.eventIds,
        blockerCodes: rollup.blockerCodes,
        outcomes: rollup.outcomes,
        requestIds: rollup.requestIds,
    })
    expect(sharedSummary(organizationRollup)).toEqual({
        eventCount: 3,
        eventIds: [71, 72],
        blockerCodes: ['redaction_required', 'invite_guard', 'manual_block'],
        outcomes: ['denied', 'success'],
        requestIds: ['rollup-request-1', 'rollup-request-2'],
    })
    expect(sharedSummary(userRollup)).toEqual(sharedSummary(organizationRollup))
    expect(organizationRollup.actionCounts).toEqual({
        inviteAssistance: 1, accessRecovery: 0, memberRoleRecovery: 0, impersonation: 0, supportSessions: 2,
    })
    expect(userRollup.actionCounts).toEqual({
        inspections: 2, inviteAssistance: 1, accessRecovery: 0, memberRoleRecovery: 0, impersonation: 0,
    })
    expect(organizationRollup.severities).toEqual(['notice'])
    expect(userRollup).not.toHaveProperty('severities')
})

