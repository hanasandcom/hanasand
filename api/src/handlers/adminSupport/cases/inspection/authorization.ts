import { auditTimelineLink } from '../../audit/auditLinks.ts'
import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportText as text } from '#utils/support/adminSupportInput.ts'

export function buildSupportInspectionAuthorization(input: {
    actorId: string
    requestedOrg: string
    requestedUser: string
    effectiveOrg: string
    effectiveUser: string
    email: string
    request: string
    entity: string
    supportSession: string
    sessionState: Record<string, any> | null
    organizationIds: string[]
}) {
    const supportSessionScoped = Boolean(input.supportSession)
    const scopedOrg = input.sessionState?.organizationId ? text(input.sessionState.organizationId) : ''
    const scopedUser = input.sessionState?.targetUserId ? text(input.sessionState.targetUserId) : ''
    const supportSessionId = input.supportSession || input.sessionState?.supportSessionId || ''
    const targetOrgIds = uniqueTimelineValues([input.effectiveOrg, ...input.organizationIds])
    return {
        schemaVersion: 'support.inspection.authorization.v1',
        supportRoleRequired: true,
        supportSessionScoped,
        supportSessionId: supportSessionId || null,
        actor: { id: input.actorId, role: 'support' },
        requested: {
            organizationId: input.requestedOrg || null,
            userId: input.requestedUser || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
        },
        effective: {
            organizationIds: targetOrgIds,
            organizationId: input.effectiveOrg || targetOrgIds[0] || null,
            userId: input.effectiveUser || null,
            email: input.email || null,
            requestId: input.request || null,
            entityId: input.entity || null,
        },
        scoped: input.sessionState ? {
            organizationId: scopedOrg || null,
            userId: scopedUser || null,
            allowedActions: Array.isArray(input.sessionState.allowedActions) ? input.sessionState.allowedActions : [],
            scope: Array.isArray(input.sessionState.scope) ? input.sessionState.scope : [],
            status: text(input.sessionState.status) || null,
            expiresAt: text(input.sessionState.expiresAt) || null,
            reasonPresent: Boolean(text(input.sessionState.reason)),
            auditEventIds: Array.isArray(input.sessionState.auditEventIds) ? input.sessionState.auditEventIds : [],
        } : null,
        guardrails: {
            noCrossOrgLeakage: true,
            noMutation: true,
            noSecretsReturned: true,
            reasonRequiredForActions: true,
            scopeRequiredForActions: true,
            durationRequiredForScopedSessions: true,
        },
        blockers: [
            supportSessionScoped && !input.sessionState ? 'support_session_not_found' : '',
            input.sessionState && text(input.sessionState.status) !== 'active' ? `support_session_${text(input.sessionState.status)}` : '',
        ].filter(Boolean),
        audit: {
            timeline: auditTimelineLink({
                org: input.effectiveOrg || targetOrgIds[0],
                target: input.effectiveUser || input.email,
                request: input.request,
                action: 'support.inspect',
            }),
            supportSession: supportSessionId ? auditTimelineLink({ request: input.request, action: 'support.session' }) : null,
        },
        redacted: true,
        copyText: [
            `Support authorization: ${supportSessionScoped ? 'scoped session' : 'support role'}`,
            `Target org: ${input.effectiveOrg || targetOrgIds[0] || '*'}`,
            `Target user: ${input.effectiveUser || input.email || '*'}`,
            `Session: ${supportSessionId || 'none'}`,
        ].join('\n'),
    }
}
