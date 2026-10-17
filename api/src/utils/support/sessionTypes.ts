export type SupportSessionState = {
    supportSessionId: string
    actorId: string
    reason: string
    requestId: string
    organizationId?: string | null
    targetUserId?: string | null
    allowedActions?: string[]
    scope?: string[]
    durationMinutes?: number
    expiresAt: string
    status: string
    revokedBy?: string | null
    revokedAt?: string | null
    auditEventIds: number[]
}
