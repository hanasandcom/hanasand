import type { FastifyRequest } from 'fastify'
import type { OrganizationRow, OrganizationRole } from '#utils/organizations.ts'
import type { supportMemberRoleRecoveryExecutorControls } from './controls.ts'

export type MemberRoleRecoveryBody = {
    role?: unknown
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
}

export type MemberRoleRecoveryRequest = FastifyRequest<{
    Params: { id: string; userId: string }
    Body: MemberRoleRecoveryBody
}>

export type MemberRoleRecoveryContext = {
    req: MemberRoleRecoveryRequest
    actor: { id: string }
    organization: OrganizationRow
    member: Record<string, unknown>
    reason: string
    requestId: string
    actionType: 'support.organization.member_role_recovery'
    role: OrganizationRole
    controls: ReturnType<typeof supportMemberRoleRecoveryExecutorControls>['value']
}

export type MemberRoleRecoveryMutation =
    | { error: 'organization_deletion_in_progress' }
    | { error: 'member_not_found' }
    | { error: 'revoked_member'; member: Record<string, unknown> }
    | { error: 'active_admin_available'; member: Record<string, unknown> }
    | { error: 'permission_denied'; member: Record<string, unknown>; ownerCount: number; message: string }
    | { error: 'member_role_already_set'; member: Record<string, unknown>; ownerCount: number }
    | { error: null; member: Record<string, unknown>; ownerCount: number; updatedMember: Record<string, unknown> }
