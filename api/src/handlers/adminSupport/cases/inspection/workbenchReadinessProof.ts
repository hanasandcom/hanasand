import { uniqueTimelineValues, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'

export function supportWorkbenchReadinessProof(input: {
    org: string
    user: string
    email: string
    request: string
    organizationIds: string[]
    activeMembershipCount: number
    pendingInviteCount: number
    noAdminAvailable: boolean
    inviteAssistAvailable: boolean
    recoveryAvailable: boolean
    impersonationEligible: boolean
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    blockers: string[]
    inviteAssistBlockers: string[]
    accessRecoveryBlockers: string[]
    impersonationBlockers: string[]
    actionPreparation: Record<string, any>
}) {
    const lastProof = input.timeline[0] || null
    return {
        schemaVersion: 'support.workbench.readiness_proof.v1',
        generatedAt: new Date().toISOString(),
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
        },
        supportActionsAvailable: {
            scopedSession: Boolean(input.organizationIds.length || input.user),
            inviteAssistance: input.inviteAssistAvailable && input.noAdminAvailable,
            inviteResendRevoke: input.pendingInviteCount > 0 && input.noAdminAvailable,
            memberRoleRecovery: input.activeMembershipCount > 0 && input.noAdminAvailable,
            accessRecovery: input.recoveryAvailable,
            impersonation: input.impersonationEligible,
        },
        requiredInputs: {
            reason: true,
            scope: true,
            expiryFor: ['inviteAssistance', 'inviteResend', 'accessRecovery'],
            durationFor: ['impersonation'],
            idempotencyKey: true,
        },
        auditFiltersAvailable: ['org', 'target', 'actor', 'action', 'outcome', 'request', 'entity', 'from', 'to', 'correlation', 'idempotency', 'supportSession', 'reason'],
        timelineFilter: input.timelineFilter,
        lastProof: lastProof ? {
            eventId: lastProof.id,
            action: lastProof.action,
            outcome: lastProof.outcome,
            severity: lastProof.severity,
            requestId: lastProof.requestId || null,
            organizationId: lastProof.organizationId || null,
            entityId: lastProof.entityId || null,
            createdAt: lastProof.createdAt || null,
        } : null,
        blockers: uniqueTimelineValues([
            ...input.blockers,
            ...input.inviteAssistBlockers,
            ...input.accessRecoveryBlockers,
            ...input.impersonationBlockers,
            input.noAdminAvailable ? '' : 'active_admin_available',
        ]),
        actionPreparation: {
            requested: Boolean(input.actionPreparation?.requested),
            action: input.actionPreparation?.action || null,
            outcome: input.actionPreparation?.outcome || null,
            requestId: input.actionPreparation?.requestId || null,
            correlationId: input.actionPreparation?.correlationId || null,
            idempotencyKey: input.actionPreparation?.idempotencyKey || null,
            blockers: input.actionPreparation?.blockers || [],
        },
        redacted: true,
    }
}
