import { auditFilterQuery, uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'
import { supportAuditWorkflowName } from './auditTemplates.ts'
import { supportAuditRedactedSummary, supportAuditActionEvidenceRollup, supportAuditWorkflowNextActions } from './auditEvidenceRollups.ts'
import { supportAuditEntityLinkRollup } from './auditEntityTimeline.ts'
import { supportCaseTimelineEntries } from './auditCaseTimeline.ts'

export function supportAuditWorkflowRollup(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const workflows = ['organization', 'watchlist', 'webhook', 'alert', 'impersonation', 'support']
    const rollup = workflows.map(workflow => {
        const events = timeline.filter(event => supportAuditWorkflowName(event) === workflow)
        const workflowFilters = {
            ...filters,
            workflow,
            source: filters.source || workflow,
        }
        return {
            workflow,
            eventCount: events.length,
            eventIds: events.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            actionTypes: uniqueTimelineValues(events.map(event => event.actionType)),
            outcomes: uniqueTimelineValues(events.map(event => event.outcome)),
            severities: uniqueTimelineValues(events.map(event => event.severity)),
            requestIds: uniqueTimelineValues(events.map(event => event.requestId)),
            redactedSummary: supportAuditRedactedSummary(events),
            links: {
                timeline: auditFilterQuery(workflowFilters),
                details: events.map(event => event.links?.detail).filter(Boolean),
            },
        }
    })
    return {
        schemaVersion: 'support.audit.workflow_rollup.v1',
        filters,
        workflows,
        rollup,
        redacted: true,
        copyText: rollup
            .filter(item => item.eventCount)
            .map(item => `${item.workflow}: ${item.eventCount} event(s), actions=${item.actionTypes.join(',') || 'none'}`)
            .join('\n'),
    }
}

export function supportAuditSupportWorkflowPacket(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const actionEvidenceRollup = supportAuditActionEvidenceRollup(timeline)
    const entityLinks = supportAuditEntityLinkRollup(timeline)
    const eventIds = timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    const caseTimelineEntries = supportCaseTimelineEntries(timeline)
    const sourceWorkflows = uniqueTimelineValues(timeline.map(event => supportAuditWorkflowName(event)))
    const blockers = uniqueTimelineValues([
        timeline.length ? '' : 'missing_audit_events',
        caseTimelineEntries.length ? '' : 'missing_case_handoff_events',
        ...actionEvidenceRollup.blockers,
    ].filter(Boolean))
    return {
        schemaVersion: 'support.audit.support_workflow_packet.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        ok: !blockers.some(blocker => blocker !== 'redaction_required'),
        customerVisible: false,
        route: '/api/admin/support/inspect',
        auditRoute: auditFilterQuery(filters),
        detailRouteTemplate: '/api/admin/audit-events/:id',
        filters,
        evidence: {
            eventCount: timeline.length,
            eventIds,
            actionEvidenceRollup,
            entityLinks,
            caseTimelineEntryCount: caseTimelineEntries.length,
            caseTimelineEntries,
            sourceWorkflows,
        },
        caseHandoffReplay: {
            schemaVersion: 'support.audit.case_handoff_replay.v1',
            redacted: true,
            noMutation: true,
            expectedConsumer: 'case.replay',
            sourceWorkflows,
            bySourceWorkflow: sourceWorkflows.map(workflow => auditFilterQuery({ ...filters, workflow, source: 'admin', service: 'hanasand-api' })),
            byRecoveryAction: ['invite', 'access_recovery', 'member_role_recovery', 'impersonation'].map(action => auditFilterQuery({ ...filters, action, source: 'admin', service: 'hanasand-api' })),
            denied: auditFilterQuery({ ...filters, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            safeHandoff: {
                noLiveAccessGrant: true,
                noSilentMembershipMutation: true,
                noSilentImpersonation: true,
                noLiveWebhookDelivery: true,
                noCrossOrgLeakage: true,
                redactionRequired: true,
            },
        },
        operatorContract: {
            requiredInputs: ['reason', 'context'],
            scopedInputs: ['scope', 'supportSessionId', 'durationMinutes', 'expiresAt', 'idempotencyKey'],
            guardedActions: ['invite_assist', 'invite_action', 'member_role_recovery', 'access_recovery', 'impersonation'],
            noSilentMutation: true,
            redactionRequired: true,
        },
        routes: {
            inspect: '/api/admin/support/inspect',
            audit: auditFilterQuery(filters),
            details: timeline.map(event => event.links?.detail).filter(Boolean),
            inviteActions: entityLinks.inviteAction,
            memberRoleRecovery: entityLinks.memberRoleRecovery,
            accessRecovery: entityLinks.accessRecovery,
            supportSessions: entityLinks.supportSession,
            impersonation: entityLinks.impersonation,
        },
        blockers,
        nextActions: supportAuditWorkflowNextActions(blockers, filters),
        copyText: [
            'Support workflow packet',
            `Audit route: ${auditFilterQuery(filters)}`,
            `Events: ${eventIds.join(', ') || 'none'}`,
            `Case handoff entries: ${caseTimelineEntries.length}`,
            `Source workflows: ${sourceWorkflows.join(', ') || 'none'}`,
            `Blockers: ${blockers.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
