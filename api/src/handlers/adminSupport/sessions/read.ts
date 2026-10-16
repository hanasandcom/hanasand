import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'
import { supportSessionAuthorizationProof, supportSessionResponse, supportSessionWorkflowRoutes } from '#utils/support/sessionPresentation.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportError, supportRequestId, supportText as text } from '#utils/support/adminSupportInput.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { auditTimelineSummary } from '../audit/auditEntityTimeline.ts'
import { supportAuditFilterContract } from '../audit/auditFilterPackets.ts'
import { supportAuditExportProof } from '../audit/auditExportPackets.ts'
import { requireAdminSupport } from '../auth.ts'
import { loadSupportSessionTimeline } from './sessionTimeline.ts'
import type { SupportSessionParams } from './sessionTypes.ts'

export async function getSupportSession(req: FastifyRequest<{ Params: SupportSessionParams }>, res: FastifyReply) {
    const actor = await requireAdminSupport(req, res)
    if (!actor) return

    const supportSessionId = text(req.params.sessionId)
    const requestId = supportRequestId(req)
    const state = await loadSupportSessionState(supportSessionId)
    if (!state) {
        await recordSystemEvent(req, {
            actionType: 'support.session.inspect',
            actorId: actor.id,
            targetType: 'support_session',
            targetId: supportSessionId,
            entityId: supportSessionId,
            requestId,
            severity: 'notice',
            outcome: 'failed',
            context: {
                schemaVersion: 'support.scoped_session.detail.v1',
                supportSessionId,
                blockerCode: 'support_session_not_found',
                redactionRequired: true,
            },
        })
        return res.status(404).send(supportError('support_session_not_found', 'Support session not found.', { supportSessionId }))
    }

    await recordSystemEvent(req, {
        actionType: 'support.session.inspect',
        actorId: actor.id,
        targetType: state.targetUserId ? 'user' : 'support_session',
        targetId: state.targetUserId || supportSessionId,
        organizationId: state.organizationId || null,
        entityId: supportSessionId,
        requestId,
        severity: 'info',
        outcome: 'success',
        context: {
            schemaVersion: 'support.scoped_session.detail.v1',
            supportSessionId,
            status: state.status,
            targetOrganizationId: state.organizationId || null,
            targetUserId: state.targetUserId || null,
            allowedActions: state.allowedActions,
            scope: state.scope,
            expiresAt: state.expiresAt,
            redactionRequired: true,
        },
    })

    const timeline = await loadSupportSessionTimeline(supportSessionId)
    const response = supportSessionResponse(state)
    const workflowRoutes = supportSessionWorkflowRoutes(state)
    const authorization = supportSessionAuthorizationProof({
        actorId: actor.id,
        state,
        supportSessionId,
        workflowRoutes,
    })
    const timelineFilters = {
        supportSession: supportSessionId,
        entity: supportSessionId,
        request: state.requestId,
        action: 'support.session',
        source: 'admin',
        service: 'hanasand-api',
    }
    const auditTimeline = {
        schemaVersion: 'support.scoped_session.audit_timeline.v1',
        filters: timelineFilters,
        eventIds: timeline.map(event => event.id),
        summary: auditTimelineSummary(timeline),
        filterContract: supportAuditFilterContract(timelineFilters, timeline),
        exportProof: supportAuditExportProof(timelineFilters, timeline),
        redacted: true,
        links: {
            timeline: auditFilterQuery(timelineFilters),
            details: timeline.map(event => event.links?.detail).filter(Boolean),
        },
    }
    return res.send({
        supportSession: response,
        detail: {
            schemaVersion: 'support.scoped_session.detail.v1',
            generatedAt: new Date().toISOString(),
            supportSession: response,
            authorization,
            timeline,
            auditTimeline,
            readinessProof: {
                schemaVersion: 'support.scoped_session.readiness_proof.v1',
                route: '/api/admin/support/sessions/:sessionId',
                auditRoute: auditTimeline.links.timeline,
                revokeRoute: `/api/admin/support/sessions/${encodeURIComponent(supportSessionId)}/revoke`,
                availableActions: state.allowedActions,
                scope: state.scope,
                blockers: state.status === 'active' ? [] : [state.status === 'revoked' ? 'support_session_revoked' : 'support_session_expired'],
                authorization,
                workflowRoutes,
                auditFields: ['actorId', 'targetId', 'organizationId', 'entityId', 'requestId', 'actionType', 'severity', 'outcome', 'createdAt'],
                testCommand: 'cd api && bun run smoke:admin-support-unit',
            },
            copyText: [
                `Support session ${state.status}: ${supportSessionId}`,
                `Actor: ${state.actorId}`,
                `Org: ${state.organizationId || '*'}`,
                `User: ${state.targetUserId || '*'}`,
                `Actions: ${state.allowedActions.join(', ') || 'none'}`,
                `Scope: ${state.scope.join(', ') || 'none'}`,
                `Expires: ${state.expiresAt}`,
                `Audit events: ${timeline.map(event => event.id).join(', ') || 'none'}`,
                `Timeline: ${auditTimeline.links.timeline}`,
            ].join('\n'),
        },
    })
}
