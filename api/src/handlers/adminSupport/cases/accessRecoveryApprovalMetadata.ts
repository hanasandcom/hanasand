export function accessRecoveryApprovalMetadata(input: {
    actorId: string
    role: string
    expiresAt: unknown
    requestId: string
    outcome: 'success' | 'failure'
    context: string
    existingMembership: unknown
    requestedApprovalRequired: unknown
}) {
    const existingRole = typeof input.existingMembership === 'object' && input.existingMembership
        ? String((input.existingMembership as { role?: unknown }).role || '')
        : ''
    const approvalRequired = Boolean(input.requestedApprovalRequired)
        || input.role === 'admin'
        || existingRole === 'owner'
        || existingRole === 'admin'

    return {
        schemaVersion: 'support.access_recovery.approval.v1',
        requestedBy: input.actorId,
        approvalRequired,
        status: approvalRequired ? 'pending_approval' : 'not_required',
        approvedBy: null as string | null,
        approvedAt: null as string | null,
        expiresAt: input.expiresAt,
        requestId: input.requestId,
        outcome: input.outcome,
        context: input.context,
        enforcement: approvalRequired ? 'invite_revoked_until_approved' : 'invite_pending_immediately',
        reason: approvalRequired
            ? 'Admin-role recovery or elevated existing membership requires second review before use.'
            : 'Member recovery does not require second review by default.',
    }
}
