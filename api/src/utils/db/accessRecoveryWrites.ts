import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'
import { updateThenInsert } from './updateThenInsert.ts'

export async function upsertAdminAccessRecoveryApproval(input: {
    requestId: string
    organizationId: string
    inviteId: string
    targetUserId: string | null
    requestedBy: string
    requestedReason: string
    requestContext: string
    approvalRequired: boolean
    status: string
    expiresAt: Date | string
}, query: IdentityQuery = run) {
    const values = [input.requestId, input.organizationId, input.inviteId, input.targetUserId,
        input.requestedBy, input.requestedReason, input.requestContext, input.approvalRequired,
        input.status, input.expiresAt]
    const update = async () => query(`
        UPDATE admin_access_recovery_approvals
           SET organization_id = $2,
               invite_id = $3,
               target_user_id = $4,
               requested_by = $5,
               requested_reason = $6,
               request_context = $7,
               approval_required = $8,
               status = $9,
               approved_by = NULL,
               approved_at = NULL,
               denied_by = NULL,
               denied_at = NULL,
               decision_reason = NULL,
               outcome = 'success',
               expires_at = $10,
               updated_at = NOW()
         WHERE request_id = $1
        RETURNING request_id
    `, values)

    await updateThenInsert(update, () => query(`
            INSERT INTO admin_access_recovery_approvals (
                request_id, organization_id, invite_id, target_user_id, requested_by,
                requested_reason, request_context, approval_required, status, outcome, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'success', $10)
        `, values))
}
