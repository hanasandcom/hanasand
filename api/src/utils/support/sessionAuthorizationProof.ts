import { auditFilterQuery } from './inspectionPackets.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportSessionAuthorizationProof(input: {
    actorId: string
    supportSessionId: string
    state: {
        actorId: string
        organizationId?: string | null
        targetUserId?: string | null
        allowedActions?: string[]
        scope?: string[]
        status?: string
        reason?: string
        requestId?: string
        expiresAt?: string
        auditEventIds?: number[]
    }
    workflowRoutes: Record<string, unknown>
}) {
    const status = text(input.state.status) || 'unknown'
    const blockers = [
        status === 'active' ? '' : status === 'revoked' ? 'support_session_revoked' : 'support_session_expired',
        input.actorId === input.state.actorId ? '' : 'support_session_actor_mismatch',
        input.state.reason ? '' : 'missing_support_reason',
        input.state.expiresAt ? '' : 'missing_expiry',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.scoped_session.authorization_proof.v1',
        supportRoleRequired: true,
        supportSessionId: input.supportSessionId,
        actor: {
            id: input.actorId,
            sessionActorId: input.state.actorId,
            matchesSessionActor: input.actorId === input.state.actorId,
        },
        target: {
            organizationId: input.state.organizationId || null,
            userId: input.state.targetUserId || null,
        },
        allowedActions: input.state.allowedActions || [],
        scope: input.state.scope || [],
        status,
        expiresAt: input.state.expiresAt || null,
        requestId: input.state.requestId || null,
        reasonPresent: Boolean(input.state.reason),
        guardrails: {
            noCrossOrgLeakage: true,
            noSilentImpersonation: true,
            noSilentMembershipMutation: true,
            reasonRequired: true,
            scopeRequired: true,
            durationOrExpiryRequired: true,
            redactionRequired: true,
        },
        blockers,
        workflowRoutes: input.workflowRoutes,
        audit: {
            eventIds: input.state.auditEventIds || [],
            timeline: auditFilterQuery({
                supportSession: input.supportSessionId,
                entity: input.supportSessionId,
                request: input.state.requestId || '',
                source: 'admin',
                service: 'hanasand-api',
            }),
        },
        redacted: true,
        copyText: [
            `Support session authorization ${input.supportSessionId}`,
            `Status: ${status}`,
            `Actor: ${input.actorId}`,
            `Target org: ${input.state.organizationId || '*'}`,
            `Target user: ${input.state.targetUserId || '*'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
