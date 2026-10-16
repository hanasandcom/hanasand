import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportAuditEventActionTemplates } from './auditTemplates.ts'

export function supportAuditEventWorkflowProof(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    filters: Record<string, unknown>
}) {
    const links = input.timelineEvent.links?.entities || {}
    const availableActions = [
        links.inspection ? 'inspect_support_state' : '',
        links.inviteAction ? 'review_invite_action' : '',
        links.accessRecovery ? 'prepare_access_recovery' : '',
        links.memberRoleRecovery ? 'prepare_member_role_recovery' : '',
        links.impersonation ? 'review_impersonation' : '',
        links.supportSession ? 'review_support_session' : '',
    ].filter(Boolean)
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const reason = text(input.detail.reason)
    const blockers = [
        reason ? '' : 'missing_reason_on_source_event',
        input.detail.organizationId || input.detail.targetId || input.detail.entityId ? '' : 'missing_structured_target',
        availableActions.length ? '' : 'no_backed_support_action_link',
    ].filter(Boolean)
    return {
        schemaVersion: 'support.audit.event_workflow_proof.v1',
        generatedAt: new Date().toISOString(),
        actionType,
        outcome,
        reasonPresent: Boolean(reason),
        target: {
            organizationId: input.detail.organizationId || null,
            targetType: input.detail.targetType || null,
            targetId: input.detail.targetId || null,
            entityId: input.detail.entityId || null,
            requestId: input.detail.requestId || null,
        },
        availableActions,
        guardedActionRequirements: {
            supportRoleRequired: true,
            reasonRequired: true,
            scopeRequired: true,
            durationOrExpiryRequired: ['prepare_access_recovery', 'review_impersonation'].some(action => availableActions.includes(action)),
            noSilentMembershipMutation: true,
            redactionRequired: true,
        },
        actionRequestTemplates: supportAuditEventActionTemplates({ links, detail: input.detail, filters: input.filters }),
        blockers,
        links: {
            inspection: links.inspection || null,
            inviteAction: links.inviteAction || null,
            accessRecovery: links.accessRecovery || null,
            memberRoleRecovery: links.memberRoleRecovery || null,
            impersonation: links.impersonation || null,
            supportSession: links.supportSession || null,
            auditTimeline: auditFilterQuery(input.filters),
        },
        copyText: [
            `Audit workflow proof for ${actionType || 'unknown action'}`,
            `Outcome: ${outcome || 'unknown'}`,
            `Reason present: ${Boolean(reason)}`,
            `Actions: ${availableActions.join(', ') || 'none'}`,
            `Timeline: ${auditFilterQuery(input.filters)}`,
        ].join('\n'),
        redacted: true,
    }
}
