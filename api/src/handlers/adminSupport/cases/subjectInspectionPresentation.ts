import type { SupportSubjectInspectionKind } from './subjectInspectionTypes.ts'
import type { buildSupportSubjectAccessState } from './subjectAccessState.ts'
import type { buildSupportSubjectInspectionReceipts } from './subjectInspectionReceipts.ts'
import type { supportRecentAuditTimeline } from './recentAuditTimeline.ts'

export function supportSubjectInspectionResponseFields(input: {
    kind: SupportSubjectInspectionKind
    targetId: string
    authorization: Record<string, any>
    subjectAccessState: ReturnType<typeof buildSupportSubjectAccessState>
    receipts: ReturnType<typeof buildSupportSubjectInspectionReceipts>
    caseAccessReadiness: Record<string, any>
    caseHandoff: Record<string, any>
    supportActivityRollup: Record<string, any>
    recentAuditTimeline: ReturnType<typeof supportRecentAuditTimeline>
    relatedRecordCount: number
    pendingInviteCount: number
}) {
    const relatedRecordLabel = input.kind === 'organization' ? 'Members' : 'Memberships'
    return {
        authorization: input.authorization,
        accessStatus: input.subjectAccessState.accessStatus,
        accessRecoveryPlan: input.subjectAccessState.accessRecoveryPlan,
        ...input.receipts,
        caseAccessReadiness: input.caseAccessReadiness,
        caseHandoff: input.caseHandoff,
        supportActivityRollup: input.supportActivityRollup,
        recentAuditEvents: input.recentAuditTimeline.events,
        recentAuditTimeline: input.recentAuditTimeline,
        copyText: [
            `Support ${input.kind} inspection ${input.targetId}`,
            `Authorization: ${input.authorization.supportSessionScoped ? 'scoped support session' : 'support role'}`,
            `Access status: ${input.subjectAccessState.accessStatus.overall}`,
            `${relatedRecordLabel}: ${input.relatedRecordCount}`,
            `Pending invites: ${input.pendingInviteCount}`,
            `Audit events: ${input.recentAuditTimeline.eventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
