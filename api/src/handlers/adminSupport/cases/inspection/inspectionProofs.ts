import {
    supportInspectionActionAuditContract,
    supportInspectionAuditFilterCoverage,
    supportInspectionAuthorizationMatrix,
    supportInspectionAuditDetailPacket,
    supportInspectionOrgBoundaryProof,
    supportInspectionRecoveryFixturePacket,
    supportInspectionSearchProof,
} from '#utils/support/inspectionPackets.ts'
import { supportInspectionEnterpriseReadiness } from './enterpriseReadiness.ts'
import { supportInspectionNegativeCaseMatrix } from './negativeCaseMatrix.ts'
import { supportInspectionApprovalDecisionPacket } from './approvalDecisionPacket.ts'
import { supportInspectionReceiptReplayPacket } from './receiptReplayPacket.ts'
import { supportSessionReplayReceipt } from './sessionReplayReceipt.ts'
import { supportInspectionReplayExportPacket } from './replayExportPacket.ts'
import type { SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'

type InspectionProofInput = {
    actorId: string
    org: string
    user: string
    email: string
    request: string
    inspectionRequestId: string
    q: string
    entity: string
    entityType: string
    supportSession: string
    organizationIds: string[]
    organizations: Array<Record<string, any>>
    users: Array<Record<string, any>>
    memberships: Array<Record<string, any>>
    invites: Array<Record<string, any>>
    approvalDetails: Array<Record<string, any>>
    timeline: Array<Record<string, any>>
    timelineFilter: SupportTimelineFilter
    authorization: Record<string, any>
    accessRecoveryPlan: Record<string, any>
    workbench: Record<string, any>
    accessStatus: Record<string, any>
    sessionState: Record<string, any> | null
}

export function buildSupportInspectionProofs(input: InspectionProofInput) {
    const searchProof = supportInspectionSearchProof(input)
    const authorizationMatrix = supportInspectionAuthorizationMatrix(input)
    const auditDetailPacket = supportInspectionAuditDetailPacket(input)
    const orgBoundaryProof = supportInspectionOrgBoundaryProof({
        ...input,
        requestedOrg: input.org,
        requestedUser: input.user,
    })
    const recoveryFixturePacket = supportInspectionRecoveryFixturePacket(input)
    const auditFilterCoverage = supportInspectionAuditFilterCoverage(input)
    const actionAuditContract = supportInspectionActionAuditContract({
        recoveryFixturePacket,
        ...input,
    })
    const enterpriseReadiness = supportInspectionEnterpriseReadiness({
        authorizationMatrix,
        auditDetailPacket,
        orgBoundaryProof,
        recoveryFixturePacket,
        auditFilterCoverage,
        actionAuditContract,
        workbench: input.workbench,
        accessStatus: input.accessStatus,
        timelineFilter: input.timelineFilter,
    })
    const negativeCaseMatrix = supportInspectionNegativeCaseMatrix({
        actionAuditContract,
        recoveryFixturePacket,
        auditFilterCoverage,
        orgBoundaryProof,
        enterpriseReadiness,
        timelineFilter: input.timelineFilter,
        supportSession: input.supportSession,
    })
    const approvalDecisionPacket = supportInspectionApprovalDecisionPacket(input)
    const receiptReplayPacket = supportInspectionReceiptReplayPacket(input)
    const sessionReplayReceipt = supportSessionReplayReceipt({
        supportSession: input.supportSession,
        sessionState: input.sessionState,
        actorId: input.actorId,
        requestId: input.inspectionRequestId,
        timelineFilter: input.timelineFilter,
        timeline: input.timeline,
        receiptReplayPacket,
        authorization: input.authorization,
    })
    const replayExportPacket = supportInspectionReplayExportPacket({
        ...input,
        actorId: input.actorId,
        actionHistory: null,
        approvalDecisionPacket,
        receiptReplayPacket,
        sessionReplayReceipt,
    })
    const inspectionTimelineProofs = {
        auditFilterCoverage,
        actionAuditContract,
        enterpriseReadiness,
        negativeCaseMatrix,
        approvalDecisionPacket,
        receiptReplayPacket,
        sessionReplayReceipt,
        replayExportPacket,
    }
    return { searchProof, inspectionTimelineProofs, authorizationMatrix, auditDetailPacket, orgBoundaryProof, recoveryFixturePacket }
}
