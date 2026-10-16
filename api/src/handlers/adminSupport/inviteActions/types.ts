import type { FastifyRequest } from 'fastify'
import type { OrganizationInviteRow, OrganizationRow } from '#utils/organizations.ts'
import type { SupportExecutorControls } from '../executorCore.ts'

export type SupportInviteAction = 'revoke' | 'resend'

export type SupportInviteActionParams = {
    id: string
    inviteId: string
}

export type SupportInviteActionBody = {
    action?: unknown
    reason?: unknown
    context?: unknown
    requestId?: unknown
    request_id?: unknown
    scope?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
    correlationId?: unknown
    correlation_id?: unknown
    idempotencyKey?: unknown
    idempotency_key?: unknown
    handoffExpiresAt?: unknown
    handoff_expires_at?: unknown
    expiresAt?: unknown
    expires_at?: unknown
}

export type SupportInviteActionRequest = FastifyRequest<{
    Params: SupportInviteActionParams
    Body: SupportInviteActionBody
}>

export type SupportInviteActionContext = {
    req: SupportInviteActionRequest
    actor: { id: string }
    organization: OrganizationRow
    invite: OrganizationInviteRow
    action: SupportInviteAction
    actionType: string
    requestId: string
    reason: string
    controls: SupportExecutorControls
}
