import type { InviteInput } from '#utils/organizations.ts'

export type OrganizationParams = { id: string }

export type SupportInviteBody = InviteInput & {
    reason?: unknown
    context?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
}
