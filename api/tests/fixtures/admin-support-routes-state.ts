// Stateful PostgreSQL fake shared by the admin support route tests.
export const state = {
    actor: { valid: true, id: 'support-admin', impersonating: false } as { valid: boolean, id: string, impersonating: boolean },
    internalAccess: true,
    eventRows: [] as Record<string, any>[],
    approvalRows: [] as Record<string, any>[],
    supportDecisionApproval: null as Record<string, any> | null,
    supportOrganization: null as Record<string, any> | null,
    supportUser: null as Record<string, any> | null,
    supportUserInvites: [] as Record<string, any>[],
    supportInspectionInvite: undefined as Record<string, any> | null | undefined,
    supportInspectionMember: undefined as Record<string, any> | null | undefined,
    supportInspectionAuditRows: [] as Record<string, any>[],
    supportInviteReads: 0,
    duplicateInviteAction: null as Record<string, any> | null,
    inviteActionWrites: 0,
    acceptedInviteWinsRace: false,
    supportRecoveryInviteStatus: null as string | null,
    supportRecoveryInviteExpiry: '2026-11-01T00:00:00.000Z' as string | null,
    supportRecoveryInviteUpsert: null as Record<string, unknown> | null,
    supportRecoveryInviteResult: null as Record<string, unknown> | null,
    supportRecoveryApprovalWrites: 0,
    supportMemberRole: 'editor',
    supportOwnerCounts: [2],
    supportAvailabilityResults: [] as Record<string, unknown>[][],
    inviteActionInputs: [] as Array<Record<string, unknown>>,
    supportSessionEvents: [] as Record<string, unknown>[],
    queries: [] as Array<{ sql: string, values: unknown[] }>,
    recordedEvents: [] as Array<Record<string, unknown>>,
    nextSupportEventId: 100,
}

export function hasSqlFragments(normalizedSql: string, fragments: string[]) {
    return fragments.every(fragment => normalizedSql.includes(fragment))
}

export function defaultSupportInviteFixture(status = 'pending') {
    return {
        id: 'invite-1', organization_id: 'org-1', email: 'member@example.com', role: 'reader', status,
        expires_at: '2026-11-01T00:00:00.000Z', accepted_at: null, accepted_by: null, revoked_at: null,
        invited_by: 'owner-1', created_at: '2026-10-01T00:00:00.000Z',
    }
}

