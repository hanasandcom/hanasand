import { withTransaction } from '#db'
import { hasOrganizationPrivacyDeletionMarker } from '#utils/organizationLifecycle.ts'
import { updateOrganizationInviteAction } from '#utils/db/identityDataWrites.ts'
import type { OrganizationInviteRow } from '#utils/organizations.ts'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'
import { loadAccessRecoveryApproval } from '../cases/accessRecoveryApprovalStore.ts'
import type { AccessRecoveryDecision } from './types.ts'

type AccessRecoveryDecisionMutation =
    | { error: 'access_recovery_request_not_found' }
    | { error: 'approval_not_pending'; approval: AccessRecoveryApprovalRow }
    | { error: 'organization_deletion_in_progress'; approval: AccessRecoveryApprovalRow }
    | { error: 'invite_not_found'; approval: AccessRecoveryApprovalRow }
    | { error: 'access_recovery_invite_expired'; approval: AccessRecoveryApprovalRow; inviteStatus: string }
    | { error: 'invite_not_mutable'; approval: AccessRecoveryApprovalRow; inviteStatus: string }
    | { error: null; approval: AccessRecoveryApprovalRow; updatedApproval: AccessRecoveryApprovalRow; invite: OrganizationInviteRow }

export async function mutateAccessRecoveryDecision(input: {
    requestId: string
    actorId: string
    decision: AccessRecoveryDecision
    reason: string
}): Promise<AccessRecoveryDecisionMutation> {
    return withTransaction(async query => {
        const lockedApproval = await loadAccessRecoveryApproval(input.requestId, query, true)
        if (!lockedApproval) return { error: 'access_recovery_request_not_found' as const }
        if (lockedApproval.status !== 'pending') return { error: 'approval_not_pending' as const, approval: lockedApproval }
        await query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [lockedApproval.organization_id])
        if (await hasOrganizationPrivacyDeletionMarker(lockedApproval.organization_id, query)) {
            return { error: 'organization_deletion_in_progress' as const, approval: lockedApproval }
        }

        const inviteBefore = await query(`
            SELECT id, status, expires_at
            FROM organization_invites
            WHERE id = $1 AND organization_id = $2
            FOR UPDATE
        `, [lockedApproval.invite_id, lockedApproval.organization_id])
        const inviteRow = inviteBefore.rows[0] as { id: string; status: string; expires_at: Date | string | null } | undefined
        if (!inviteRow) return { error: 'invite_not_found' as const, approval: lockedApproval }
        if (input.decision === 'approved' && (!inviteRow.expires_at || new Date(inviteRow.expires_at).getTime() <= Date.now())) {
            return { error: 'access_recovery_invite_expired' as const, approval: lockedApproval, inviteStatus: inviteRow.status }
        }
        const invite = await updateOrganizationInviteAction({
            organizationId: lockedApproval.organization_id,
            inviteId: lockedApproval.invite_id,
            action: input.decision === 'approved' ? 'resend' : 'revoke',
            ...(input.decision === 'approved' ? { expiresAt: inviteRow.expires_at || undefined } : {}),
        }, query)
        if (!invite) return { error: 'invite_not_mutable' as const, approval: lockedApproval, inviteStatus: inviteRow.status }

        const updatedApproval = await query(`
            UPDATE admin_access_recovery_approvals
            SET status = $2,
                approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE NULL END,
                approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
                denied_by = CASE WHEN $2 = 'denied' THEN $3 ELSE NULL END,
                denied_at = CASE WHEN $2 = 'denied' THEN NOW() ELSE NULL END,
                decision_reason = $4,
                outcome = CASE WHEN $2 = 'approved' THEN 'success' ELSE 'denied' END,
                updated_at = NOW()
            WHERE request_id = $1 AND status = 'pending'
            RETURNING *
        `, [lockedApproval.request_id, input.decision, input.actorId, input.reason])
        if (!updatedApproval.rows[0]) throw new Error('Locked access recovery approval could not be updated.')
        return {
            error: null,
            approval: lockedApproval,
            updatedApproval: updatedApproval.rows[0] as AccessRecoveryApprovalRow,
            invite: invite as OrganizationInviteRow,
        }
    })
}
