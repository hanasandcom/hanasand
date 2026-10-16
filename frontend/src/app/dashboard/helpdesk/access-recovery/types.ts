export type RecoveryPayload = {
    recovery?: {
        requestId: string
        reason: string
        approvalRequired: boolean
        approvalStatus: string
        invite: {
            id: string
            email: string
            role: string
            expiresAt: string
        }
        audit: {
            query: string
            actionType: string
            outcome: string
        }
        copyText: string
    }
    error?: string
}

export type DecisionDetail = {
    requestId: string
    organizationId: string
    inviteId: string
    status: string
    outcome: string
    auditEventIds?: number[]
    invite: {
        email: string
        role: string
        status: string
        expiresAt: string
    }
    copyText: string
}

export type DecisionPayload = {
    decision?: DecisionDetail
    error?: string
}

export type InviteActionPayload = {
    inviteAction?: {
        requestId: string
        action: string
        outcome: string
        audit?: { query?: string, actionType?: string }
        invite?: { email?: string, status?: string, role?: string }
    }
    error?: string
}

export type MemberRolePayload = {
    memberRoleRecovery?: {
        requestId: string
        outcome: string
        requestedRole?: string
        audit?: { query?: string, actionType?: string }
        member?: { name?: string, role?: string, status?: string }
    }
    error?: string
}

export type ApiUsageResetPayload = {
    reset?: {
        apiKeyId: string
        ownerId: string
        keyPrefix: string
        resetBucketCount: number
        auditAction: string
    }
    error?: string
}

export type ApprovalSearchPayload = {
    approvals?: DecisionDetail[]
    error?: string
}

export type ImpersonationPayload = {
    session?: {
        id?: string
        target?: { id?: string, name?: string }
        reason?: string
        duration_minutes?: number
        scope?: string[]
        support_session_id?: string | null
        organization_id?: string | null
        expires_at?: string
    }
    error?: string
    detail?: { code?: string, message?: string }
}

export type InspectionPayload = {
    organization?: { id?: string, name?: string, slug?: string, status?: string }
    user?: { id?: string, name?: string, active?: boolean }
    accessStatus?: { overall?: string, blockers?: string[], reasons?: string[] }
    members?: Array<{ userId?: string, user_id?: string, name?: string, role?: string, status?: string }>
    memberships?: Array<{ organizationId?: string, organization_id?: string, organizationName?: string, organization_name?: string, role?: string, status?: string }>
    invites?: Array<{ id?: string, email?: string, role?: string, status?: string, expiresAt?: string, expires_at?: string }>
    pendingInvites?: Array<{ id?: string, email?: string, role?: string, status?: string, expiresAt?: string, expires_at?: string }>
    watchlistItems?: Array<{ id?: string, kind?: string, value?: string }>
    webhookDestinations?: Array<{ id?: string, name?: string, kind?: string, status?: string, endpointHint?: string, endpoint_hint?: string }>
    recentAuditEvents?: Array<{ id?: number, actionType?: string, action_type?: string, outcome?: string, reason?: string, createdAt?: string, created_at?: string }>
    supportLinks?: Record<string, string | null>
    error?: string
}

export type SupportOperation = 'inspect' | 'impersonation' | 'recovery' | 'decision' | 'queue' | 'invite' | 'member' | 'apiUsage'
export type InspectionUserMember = NonNullable<InspectionPayload['members']>[number]
export type InspectionOrganizationMembership = NonNullable<InspectionPayload['memberships']>[number]
export type InspectionMember = InspectionUserMember | InspectionOrganizationMembership
