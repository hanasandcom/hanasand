import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'

export function supportAuditEventActionTemplates(input: {
    links: Record<string, any>
    detail: Record<string, any>
    filters: Record<string, unknown>
}) {
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const requestId = text(input.detail.requestId || input.filters.request)
    const baseBody = {
        reason: 'Required support reason describing the customer request.',
        context: 'Support case, requester, and verification notes.',
        requestId: requestId || 'generated-request-id',
    }
    return {
        schemaVersion: 'support.audit.event_action_templates.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        sourceEvent: {
            actionType: input.detail.actionType || null,
            outcome: input.detail.outcome || null,
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            requestId: requestId || null,
        },
        templates: {
            inspect: input.links.inspection ? {
                method: 'GET',
                route: input.links.inspection,
                reasonRequired: false,
                expectedAuditAction: 'support.inspect',
            } : null,
            inviteAction: input.links.inviteAction ? {
                method: 'POST',
                route: input.links.inviteAction,
                body: {
                    ...baseBody,
                    action: 'resend',
                    scope: 'invite:resend',
                    expiresAt: 'future ISO timestamp for resend',
                },
                reasonRequired: true,
                scopeRequired: true,
                expiryRequired: true,
                expectedAuditAction: 'support.organization.invite_resend',
            } : null,
            accessRecovery: input.links.accessRecovery ? {
                method: 'POST',
                route: input.links.accessRecovery,
                body: {
                    ...baseBody,
                    email: targetId || 'customer@example.com',
                    role: 'admin',
                    scope: 'recovery:invite',
                    expiresAt: 'future ISO timestamp',
                },
                reasonRequired: true,
                scopeRequired: true,
                expiryRequired: true,
                expectedAuditAction: 'support.organization.access_recovery',
            } : null,
            memberRoleRecovery: input.links.memberRoleRecovery ? {
                method: 'POST',
                route: input.links.memberRoleRecovery,
                body: {
                    ...baseBody,
                    role: 'admin',
                    scope: 'member:role_recovery',
                },
                reasonRequired: true,
                scopeRequired: true,
                expectedAuditAction: 'support.organization.member_role_recovery',
            } : null,
            impersonation: input.links.impersonation ? {
                method: 'POST',
                route: '/api/impersonation/start',
                body: {
                    ...baseBody,
                    object_id: targetId || entityId || 'target-user-id',
                    organizationId: organizationId || undefined,
                    scope: ['read_profile', 'read_org'],
                    durationMinutes: 30,
                },
                reasonRequired: true,
                scopeRequired: true,
                durationRequired: true,
                expectedAuditAction: 'impersonation.start',
            } : null,
            supportSession: input.links.supportSession ? {
                method: 'GET',
                route: input.links.supportSession,
                reasonRequired: false,
                expectedAuditAction: 'support.session.inspect',
            } : null,
        },
        auditReplay: auditFilterQuery(input.filters),
        blockers: [
            organizationId || targetId || entityId ? '' : 'missing_structured_target',
            requestId ? '' : 'missing_request_id',
        ].filter(Boolean),
    }
}

export function supportAuditWorkflowName(event: Record<string, any>) {
    const contextWorkflow = text(event.context?.workflow)
    if (contextWorkflow) return contextWorkflow
    const source = text(event.source)
    if (source) return source
    const action = text(event.actionType)
    if (action.startsWith('organization.')) return 'organization'
    if (action.includes('watchlist')) return 'watchlist'
    if (action.includes('webhook')) return 'webhook'
    if (action.includes('alert')) return 'alert'
    if (action.startsWith('impersonation.')) return 'impersonation'
    return 'support'
}
