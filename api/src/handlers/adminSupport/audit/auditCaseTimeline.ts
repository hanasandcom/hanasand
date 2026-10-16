import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'

export function supportCaseTimelineEvidence(timeline: Array<Record<string, any>>) {
    return {
        auditEventIds: timeline.map(event => Number(event.id)).filter(id => Number.isFinite(id)),
        actions: uniqueTimelineValues(timeline.map(event => event.action || event.actionType)),
        outcomes: uniqueTimelineValues(timeline.map(event => event.outcome)),
        caseTimeline: supportCaseTimelineEntries(timeline),
    }
}

export function supportCaseTimelineEntries(timeline: Array<Record<string, any>>) {
    return timeline
        .filter(event => {
            const actionType = text(event.actionType || event.action)
            return actionType.startsWith('support.')
                || actionType.startsWith('impersonation.')
                || /invite|access_recovery|member_role_recovery|recovery/.test(actionType)
        })
        .map(event => {
            const actionType = text(event.actionType || event.action)
            const organizationId = text(event.organization?.id || event.organizationId)
            const targetId = text(event.target?.id || event.targetId)
            const entityId = text(event.entity?.id || event.entityId)
            const requestId = text(event.requestId)
            const supportSessionId = text(event.actionEvidence?.supportSessionId || event.context?.supportSessionId)
            const blockerCodes = uniqueTimelineValues([
                event.actionEvidence?.blockerCode,
                event.actionEvidence?.blockers,
                event.context?.blockerCode,
                event.context?.blocker,
            ].flat())
            const outcome = text(event.outcome)
            const reason = text(event.reason || event.actionEvidence?.reason)
            return {
                schemaVersion: 'support.case.timeline_entry.v1',
                auditEventId: Number(event.id),
                timestamp: event.timestamp || event.createdAt || null,
                actionType,
                severity: event.severity || null,
                outcome: outcome || null,
                actorId: event.actor?.id || event.actorId || null,
                target: {
                    type: event.target?.type || event.entityType || null,
                    id: targetId || null,
                },
                organizationId: organizationId || null,
                entityId: entityId || null,
                requestId: requestId || null,
                supportSessionId: supportSessionId || null,
                operatorNotes: {
                    reason: reason || null,
                    reasonRequired: actionType.startsWith('support.') || actionType.startsWith('impersonation.'),
                    contextPresent: Boolean(event.context && Object.keys(event.context).length),
                    blockerCodes,
                    reviewRequired: outcome === 'denied' || blockerCodes.some(Boolean),
                },
                recoveryState: {
                    inviteRecovery: actionType.includes('invite'),
                    accessRecovery: actionType.includes('access_recovery'),
                    memberRecovery: actionType.includes('member_role_recovery'),
                    impersonation: actionType.startsWith('impersonation.'),
                    allowed: outcome === 'success' && blockerCodes.length === 0,
                    denialReasonCodes: outcome === 'denied' ? blockerCodes.length ? blockerCodes : ['support_action_denied'] : [],
                },
                replay: {
                    current: auditFilterQuery({
                        org: organizationId,
                        target: targetId,
                        entity: entityId,
                        request: requestId,
                        action: actionType,
                        outcome,
                        supportSession: supportSessionId,
                        reason,
                        source: 'admin',
                        service: 'hanasand-api',
                    }),
                    denied: auditFilterQuery({
                        org: organizationId,
                        target: targetId,
                        entity: entityId,
                        request: requestId,
                        action: actionType,
                        outcome: 'denied',
                        source: 'admin',
                        service: 'hanasand-api',
                    }),
                },
                links: {
                    auditDetail: event.links?.detail || (Number.isFinite(Number(event.id)) ? `/api/admin/audit-events/${encodeURIComponent(String(event.id))}` : null),
                    supportInspection: event.links?.entities?.inspection || null,
                    supportSession: event.links?.supportSession || event.links?.entities?.supportSession || null,
                },
                redacted: true,
                forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl', 'sessionToken', 'inviteToken'],
            }
        })
}
