import run from '#db'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'

export async function loadAccessRecoveryApproval(requestId: string, query: typeof run = run, lock = false) {
    const result = await query(`
        SELECT
            approval.*,
            invite.email,
            invite.role,
            invite.status AS invite_status,
            organization.name AS organization_name
        FROM admin_access_recovery_approvals approval
        JOIN organization_invites invite ON invite.id = approval.invite_id
        LEFT JOIN organizations organization ON organization.id = approval.organization_id
        WHERE approval.request_id = $1
        LIMIT 1${lock ? '\n        FOR UPDATE OF approval' : ''}
    `, [requestId])
    return result.rows[0] as AccessRecoveryApprovalRow | undefined
}
