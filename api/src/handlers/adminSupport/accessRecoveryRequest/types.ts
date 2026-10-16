import type { FastifyRequest } from 'fastify'
import type { InviteInput, normalizeInviteInput, OrganizationInviteRow, OrganizationRow } from '#utils/organizations.ts'
import type { accessRecoveryApprovalMetadata } from '../cases/accessRecoveryApprovalMetadata.ts'

export type SupportAccessRecoveryBody = InviteInput & {
    targetUserId?: unknown
    reason?: unknown
    context?: unknown
    caseId?: unknown
    approvalRequired?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    requestId?: unknown
    request_id?: unknown
}

export type SupportAccessRecoveryRequest = FastifyRequest<{
    Params: { id: string }
    Body: SupportAccessRecoveryBody
}>

export type SupportAccessRecoveryRequestContext = {
    req: SupportAccessRecoveryRequest
    actor: { id: string }
    organization: OrganizationRow
    requestId: string
    reason: string
    input: ReturnType<typeof normalizeInviteInput>
    targetUserId: string
    supportSessionId: string
    supportContext: string
    existingMembership: Record<string, unknown> | null
    inviteRow: OrganizationInviteRow
    approval: ReturnType<typeof accessRecoveryApprovalMetadata>
}

export type PreparedSupportAccessRecoveryRequest = Omit<SupportAccessRecoveryRequestContext, 'existingMembership' | 'inviteRow' | 'approval'>
