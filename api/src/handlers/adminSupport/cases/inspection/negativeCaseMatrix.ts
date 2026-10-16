import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function supportInspectionNegativeCaseMatrix(input: {
    actionAuditContract: Record<string, any>
    recoveryFixturePacket: Record<string, any>
    auditFilterCoverage: Record<string, any>
    orgBoundaryProof: Record<string, any>
    enterpriseReadiness: Record<string, any>
    timelineFilter: SupportTimelineFilter
    supportSession: string
}) {
    const actionContracts = Array.isArray(input.actionAuditContract.actionContracts) ? input.actionAuditContract.actionContracts : []
    const expectedActions = uniqueTimelineValues(actionContracts.map((contract: Record<string, any>) => contract.actionType))
    const requestId = text(input.actionAuditContract.audit?.expectedRequestId || input.recoveryFixturePacket.audit?.expectedRequestId)
    const orgIds = Array.isArray(input.enterpriseReadiness.target?.organizationIds) ? input.enterpriseReadiness.target.organizationIds : []
    const targetId = text(input.enterpriseReadiness.target?.userId || input.enterpriseReadiness.target?.email)
    const firstAction = expectedActions[0] || 'support.organization.access_recovery'
    const cases = [
        {
            code: 'missing_reason',
            status: 400,
            appliesTo: expectedActions,
            expectedOutcome: 'denied',
            blocker: 'missing_reason',
            replay: auditFilterQuery({ action: firstAction, outcome: 'denied', request: requestId, reason: '' }),
        },
        {
            code: 'missing_context',
            status: 400,
            appliesTo: expectedActions,
            expectedOutcome: 'denied',
            blocker: 'missing_context',
            replay: auditFilterQuery({ action: firstAction, outcome: 'denied', request: requestId, context: '' }),
        },
        {
            code: 'missing_scope',
            status: 400,
            appliesTo: expectedActions,
            expectedOutcome: 'denied',
            blocker: 'missing_scope',
            replay: auditFilterQuery({ action: firstAction, outcome: 'denied', request: requestId, blocker: 'missing_scope' }),
        },
        {
            code: 'non_support_actor',
            status: 403,
            appliesTo: ['support.inspect', ...expectedActions],
            expectedOutcome: 'denied',
            blocker: 'support_role_required',
            replay: auditFilterQuery({ source: 'admin', service: 'hanasand-api', outcome: 'denied', blocker: 'support_role_required' }),
        },
        {
            code: 'wrong_org_scope',
            status: 403,
            appliesTo: ['support.inspect', ...expectedActions],
            expectedOutcome: 'denied',
            blocker: 'cross_org_match_requires_explicit_scope',
            replay: auditFilterQuery({ org: orgIds[0] || '', outcome: 'denied', blocker: 'cross_org_match_requires_explicit_scope' }),
        },
        {
            code: 'expired_or_revoked_support_session',
            status: 403,
            appliesTo: ['support.session', ...expectedActions],
            expectedOutcome: 'denied',
            blocker: 'support_session_expired_or_revoked',
            replay: auditFilterQuery({ supportSession: input.supportSession, outcome: 'denied', action: 'support.session' }),
        },
        {
            code: 'denied_recovery_approval',
            status: 409,
            appliesTo: ['support.organization.access_recovery'],
            expectedOutcome: 'denied',
            blocker: 'recovery_approval_denied',
            replay: auditFilterQuery({ action: 'support.organization.access_recovery', outcome: 'denied', request: requestId, target: targetId }),
        },
        {
            code: 'duplicate_invite_or_idempotency_key',
            status: 409,
            appliesTo: ['support.organization.invite_resend', 'support.organization.invite_revoke', 'support.organization.access_recovery'],
            expectedOutcome: 'denied',
            blocker: 'duplicate_idempotency_key',
            replay: auditFilterQuery({ action: 'support.organization.invite', outcome: 'denied', request: requestId, blocker: 'duplicate_idempotency_key' }),
        },
        {
            code: 'missing_audit_sink',
            status: 503,
            appliesTo: expectedActions,
            expectedOutcome: 'failed',
            blocker: 'audit_unavailable',
            replay: auditFilterQuery({ action: firstAction, outcome: 'failed', blocker: 'audit_unavailable' }),
        },
    ]
    return {
        schemaVersion: 'support.inspection.negative_case_matrix.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: input.enterpriseReadiness.target || {},
        matrix: cases,
        coverage: {
            expectedActions,
            structuredFiltersAvailable: Boolean(input.enterpriseReadiness.capabilities?.structuredAuditFilters?.available),
            targetBounded: Boolean(input.auditFilterCoverage.targetBounded),
            orgBoundaryProof: input.orgBoundaryProof.schemaVersion || null,
            actionAuditContract: input.actionAuditContract.schemaVersion || null,
        },
        requiredAssertions: [
            'missing reason returns 400 and is audited as denied when an audit sink is available',
            'non-support actor returns 403 without leaking org/member/invite state',
            'wrong org or support-session scope returns typed blocker',
            'expired or revoked scoped session cannot execute support actions',
            'denied recovery approval remains visible in audit filters',
            'duplicate invite/idempotency key returns existing audit linkage',
            'missing audit sink returns typed failure instead of silent mutation',
        ],
        replay: {
            denied: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            failed: auditFilterQuery({ ...input.timelineFilter, outcome: 'failed' }),
            blockers: cases.map(testCase => auditFilterQuery({ blocker: testCase.blocker, outcome: testCase.expectedOutcome })),
        },
        blockers: uniqueTimelineValues([
            expectedActions.length ? '' : 'missing_support_action_contracts',
            input.enterpriseReadiness.ready ? '' : 'enterprise_readiness_blocked',
            ...(Array.isArray(input.enterpriseReadiness.blockers) ? input.enterpriseReadiness.blockers : []),
        ]),
        copyText: [
            `Support negative matrix actions=${expectedActions.join(',') || 'none'}`,
            `Cases: ${cases.map(testCase => testCase.code).join(', ')}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
