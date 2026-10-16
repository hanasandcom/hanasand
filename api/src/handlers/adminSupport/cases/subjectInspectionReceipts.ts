import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { supportOrgUserInspectionReceipt } from './inspectionReceipt.ts'
import { supportOrgUserActionHistoryReceipt } from './actionHistoryReceipt.ts'
import { supportOrgUserActionHistoryExportReceipt } from './subjectInspectionExport.ts'
import type { SupportSubjectInspectionKind } from './subjectInspectionTypes.ts'

export function buildSupportSubjectInspectionReceipts(input: {
    kind: SupportSubjectInspectionKind
    actorId: string
    targetId: string
    organizationIds: string[]
    requestId: string
    reason: string
    supportContext: string
    timelineFilter: SupportTimelineFilter
    timeline: Array<Record<string, any>>
    supportActivityRollup: Record<string, any>
    accessStatus: Record<string, any>
    accessRecoveryPlan: Record<string, any>
}) {
    const organization = input.kind === 'organization'
    const encodedTargetId = encodeURIComponent(input.targetId)
    const inspectionRoutes: Record<string, string | null> = organization ? {
        self: `/api/admin/support/organizations/${encodedTargetId}`,
        audit: `/api/admin/audit-events?org=${encodedTargetId}`,
        accessRecovery: `/api/admin/support/organizations/${encodedTargetId}/access-recovery`,
        inviteAssist: `/api/admin/support/organizations/${encodedTargetId}/invites`,
    } : {
        self: `/api/admin/support/users/${encodedTargetId}`,
        audit: `/api/admin/audit-events?target=${encodedTargetId}`,
        impersonation: '/api/impersonation/start',
        accessRecovery: input.organizationIds[0]
            ? `/api/admin/support/organizations/${encodeURIComponent(input.organizationIds[0])}/access-recovery`
            : null,
    }
    const exportRoutes: Record<string, string | null> = {
        ...inspectionRoutes,
        impersonation: organization
            ? `/api/impersonation/events?org=${encodedTargetId}`
            : `/api/impersonation/events?target=${encodedTargetId}`,
    }
    const inspectionReceipt = supportOrgUserInspectionReceipt({
        ...input,
        supportSession: '',
        nextRoutes: inspectionRoutes,
    })
    const actionHistoryReceipt = supportOrgUserActionHistoryReceipt({
        ...input,
        supportSession: '',
        inspectionReceipt,
        nextRoutes: inspectionRoutes,
    })
    const actionHistoryExport = supportOrgUserActionHistoryExportReceipt({
        ...input,
        inspectionReceipt,
        actionHistoryReceipt,
        nextRoutes: exportRoutes,
    })
    return { inspectionReceipt, actionHistoryReceipt, actionHistoryExport }
}
