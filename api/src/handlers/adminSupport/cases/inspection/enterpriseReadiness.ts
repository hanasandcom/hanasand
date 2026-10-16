import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
export function supportInspectionEnterpriseReadiness(input: {
    authorizationMatrix: Record<string, any>
    auditDetailPacket: Record<string, any>
    orgBoundaryProof: Record<string, any>
    recoveryFixturePacket: Record<string, any>
    auditFilterCoverage: Record<string, any>
    actionAuditContract: Record<string, any>
    workbench: Record<string, any>
    accessStatus: Record<string, any>
    timelineFilter: SupportTimelineFilter
}) {
    const actionContracts = Array.isArray(input.actionAuditContract.actionContracts) ? input.actionAuditContract.actionContracts : []
    const recoveryFixtures = Array.isArray(input.recoveryFixturePacket.fixtures) ? input.recoveryFixturePacket.fixtures : []
    const detailRoutes = Array.isArray(input.auditDetailPacket.detailRoutes) ? input.auditDetailPacket.detailRoutes : []
    const allBlockers = uniqueTimelineValues([
        ...(Array.isArray(input.authorizationMatrix.blockers) ? input.authorizationMatrix.blockers : []),
        ...(Array.isArray(input.auditDetailPacket.blockers) ? input.auditDetailPacket.blockers : []),
        ...(Array.isArray(input.orgBoundaryProof.blockers) ? input.orgBoundaryProof.blockers : []),
        ...(Array.isArray(input.recoveryFixturePacket.blockers) ? input.recoveryFixturePacket.blockers : []),
        ...(Array.isArray(input.auditFilterCoverage.blockers) ? input.auditFilterCoverage.blockers : []),
        ...(Array.isArray(input.actionAuditContract.blockers) ? input.actionAuditContract.blockers : []),
    ])
    const actionNames = uniqueTimelineValues(actionContracts.map((contract: Record<string, any>) => contract.actionType))
    const ready = Boolean(
        input.authorizationMatrix.supportRoleRequired
        && input.auditFilterCoverage.targetBounded
        && detailRoutes.length
        && actionContracts.length
        && !allBlockers.some(blocker => ['missing_reason_on_fixture', 'missing_context_on_fixture', 'missing_scope_on_fixture', 'support_session_org_mismatch', 'support_session_user_mismatch'].includes(blocker)),
    )
    return {
        schemaVersion: 'support.inspection.enterprise_readiness.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        ready,
        target: {
            organizationIds: input.orgBoundaryProof.matched?.organizationIds || input.actionAuditContract.target?.organizationIds || [],
            userId: input.actionAuditContract.target?.userId || null,
            email: input.actionAuditContract.target?.email || null,
            requestId: input.actionAuditContract.target?.requestId || null,
            supportSessionId: input.actionAuditContract.target?.supportSessionId || null,
        },
        capabilities: {
            structuredAuditFilters: {
                available: true,
                targetBounded: Boolean(input.auditFilterCoverage.targetBounded),
                unsupportedFilters: input.auditFilterCoverage.unsupportedFilters || [],
                replay: input.auditFilterCoverage.replay?.current || auditFilterQuery(input.timelineFilter),
            },
            supportInspection: {
                available: true,
                orgBoundaryProof: input.orgBoundaryProof.schemaVersion,
                auditDetailRoutes: detailRoutes,
                noCrossOrgLeakage: Boolean(input.orgBoundaryProof.guardrails?.noCrossOrgLeakage),
            },
            inviteAccessRecovery: {
                available: Boolean(input.workbench.inviteAssistance?.available || input.workbench.accessRecovery?.available || recoveryFixtures.length),
                fixtures: recoveryFixtures.map((fixture: Record<string, any>) => fixture.name).filter(Boolean),
                expectedAuditActions: input.recoveryFixturePacket.audit?.expectedActions || [],
            },
            impersonationGuardrails: {
                available: Boolean(input.workbench.impersonationAssistance?.eligible || actionNames.includes('impersonation.start')),
                reasonRequired: true,
                scopeRequired: true,
                durationRequired: true,
                auditAction: 'impersonation.start',
            },
            sensitiveActionAudit: {
                available: Boolean(actionContracts.length),
                expectedActions: actionNames,
                immutableAuditEventRequired: Boolean(input.actionAuditContract.requiredForEverySensitiveAction?.immutableAuditEvent),
            },
        },
        accessStatus: {
            overall: input.accessStatus.overall || 'unknown',
            blockers: input.accessStatus.blockers || [],
            auditEventIds: input.accessStatus.audit?.eventIds || [],
        },
        worker3Proof: {
            route: '/api/admin/support/inspect',
            responsePath: 'inspection.enterpriseReadiness',
            focusedCheck: 'cd api && bun scripts/smoke-admin-support-contract.ts',
            typecheck: 'cd api && ./node_modules/.bin/tsc --noEmit --pretty false',
            expectedSchemas: [
                'support.inspection.enterprise_readiness.v1',
                'support.inspection.audit_filter_coverage.v1',
                'support.inspection.action_audit_contract.v1',
                'support.inspection.recovery_fixture_packet.v1',
                'support.inspection.org_boundary_proof.v1',
            ],
        },
        blockers: allBlockers,
        copyText: [
            `Enterprise support readiness: ${ready ? 'ready' : 'blocked'}`,
            `Actions: ${actionNames.join(', ') || 'none'}`,
            `Audit replay: ${input.auditFilterCoverage.replay?.current || auditFilterQuery(input.timelineFilter)}`,
            `Blockers: ${allBlockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
