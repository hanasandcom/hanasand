import type { FastifyRequest } from 'fastify'
import { normalizeInviteInput } from '#utils/organizations.ts'
import { supportExecutorControls, recordSupportExecutorBlock, supportExecutorMetadata, type SupportExecutorControlsResult } from '../executorCore.ts'
import { supportExecutorAuditPreview, supportExecutorAuditQuery, supportExecutorCommonBlockerCatalog } from '../executorAudit.ts'
import type { SupportInviteBody } from './types.ts'

export function supportInviteAssistExecutorControls(
    req: FastifyRequest,
    body: SupportInviteBody | undefined,
    requestId: string,
): SupportExecutorControlsResult {
    return supportExecutorControls({
        req,
        body,
        requestId,
        idempotencyAction: 'invite_assist',
        scopeAction: 'invite_assist',
        requiredScope: 'invite:create',
        invalidScopeMessage: 'Invite assistance execution requires invite:create scope.',
        invalidExpiryMessage: 'Support invite assistance handoff expiry must be a valid timestamp.',
        expiredHandoffMessage: 'Support invite assistance handoff has expired; prepare a fresh action before executing.',
    })
}

export async function recordSupportInviteAssistExecutorBlock(req: FastifyRequest, input: {
    actorId: string
    organizationId: string
    requestId: string
    reason: string
    blocker: string
    input: ReturnType<typeof normalizeInviteInput>
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    supportContext: string
}) {
    return recordSupportExecutorBlock(req, {
        actionType: 'support.organization.invite_assist',
        action: 'invite_assist',
        actorId: input.actorId,
        targetType: 'organization',
        targetId: input.organizationId,
        entityId: input.input.emails.join(','),
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        severity: 'notice',
        blocker: input.blocker,
        controls: input.controls,
        supportContext: input.supportContext,
        actionContext: { emails: input.input.emails, role: input.input.role, expiresAt: input.input.expiresAt },
    })
}


export function supportInviteAssistExecutorBlocker(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    blockers: string[]
}) {
    return supportInviteAssistExecutorDetail({
        organizationId: input.organizationId,
        requestId: input.requestId,
        reason: input.reason,
        controls: input.controls,
        input: input.input,
        inviteIds: [],
        outcome: 'denied',
        blockers: input.blockers,
    })
}




export function supportInviteAssistExecutorDetail(input: {
    organizationId: string
    requestId: string
    reason: string
    controls: ReturnType<typeof supportInviteAssistExecutorControls>['value']
    input: ReturnType<typeof normalizeInviteInput>
    inviteIds: string[]
    outcome: 'success' | 'denied'
    blockers: string[]
}) {
    return {
        schemaVersion: 'support.action_execute.invite_assist.v1',
        mutationMode: 'controlled_invite_row_only',
        action: 'invite_assist',
        ...supportExecutorMetadata(input.requestId, input.controls, true),
        target: {
            organizationId: input.organizationId,
            emails: input.input.emails,
            inviteIds: input.inviteIds,
        },
        scope: input.controls.scope,
        expiresAt: input.input.expiresAt,
        handoffExpiresAt: input.controls.handoffExpiresAt,
        outcome: input.outcome,
        blockers: input.blockers,
        blockerCatalog: [
            ...supportExecutorCommonBlockerCatalog,
            'ambiguous_target',
            'active_admin_available',
            'support_session_not_found',
            'support_session_revoked',
            'support_session_expired',
            'support_session_actor_mismatch',
            'support_session_org_mismatch',
            'support_session_action_denied',
            'support_session_scope_denied',
            'invite_unavailable',
            'mutation_unavailable',
            'audit_unavailable',
            'redaction_required',
            'unsafe_impersonation',
        ],
        redactedAuditPreview: supportExecutorAuditPreview({
            ...input,
            actionType: 'support.organization.invite_assist',
            targetFields: { emails: input.input.emails, inviteIds: input.inviteIds, expiresAt: input.input.expiresAt },
        }),
    }
}

export function supportInviteAssistAuditQuery(input: {
    requestId: string
    organizationId: string
    entityId: string
    correlationId: string
    idempotencyKey: string
    reason: string
}) {
    return supportExecutorAuditQuery({ ...input, entityId: input.entityId || undefined, actionType: 'support.organization.invite_assist', outcome: 'success' })
}
