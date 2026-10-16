import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { supportAuditWorkflowName } from './auditTemplates.ts'

export function supportAuditActionEvidence(input: {
    event: Record<string, any>
    context: Record<string, unknown>
    entityId: unknown
    supportSessionId: string
}) {
    const actionType = text(input.event.event_type)
    const workflow = supportAuditWorkflowName({
        actionType,
        source: input.event.source,
        context: input.context,
    })
    const reason = text(input.event.reason)
    const blockerCode = text(input.context.blockerCode || input.context.blocker)
    const scope = input.context.scope ?? null
    const durationMinutes = input.context.durationMinutes ?? null
    const expiresAt = input.context.expiresAt ?? null
    const requiresReason = workflow === 'support' || workflow === 'impersonation' || actionType.startsWith('support.') || actionType.startsWith('impersonation.')
    const requiresScope = actionType.includes('invite') || actionType.includes('recovery') || actionType.includes('impersonation') || actionType.includes('role_recovery')
    const requiresDurationOrExpiry = actionType.includes('impersonation') || actionType.includes('invite') || actionType.includes('recovery')
    const actionLinkFilters = {
        org: input.event.organization_id || '',
        actor: input.event.actor_id || '',
        target: input.event.object_id || '',
        action: actionType,
        outcome: input.event.outcome || '',
        entity: input.entityId || '',
        request: input.event.request_id || '',
        supportSession: input.supportSessionId || '',
        reason,
    }

    return {
        schemaVersion: 'support.audit.action_evidence.v1',
        generatedAt: new Date().toISOString(),
        workflow,
        actionType,
        outcome: input.event.outcome || null,
        severity: input.event.severity || null,
        actor: {
            id: input.event.actor_id || null,
        },
        target: {
            type: input.event.object_type || null,
            id: input.event.object_id || null,
        },
        organizationId: input.event.organization_id || null,
        entityId: input.entityId || null,
        requestId: input.event.request_id || null,
        correlationId: text(input.context.correlationId) || input.event.request_id || null,
        idempotencyKey: text(input.context.idempotencyKey) || null,
        supportSessionId: input.supportSessionId || null,
        reasonPresent: Boolean(reason),
        reason: reason || null,
        scope,
        durationMinutes,
        expiresAt,
        blockerCode: blockerCode || null,
        controls: {
            supportRoleRequired: actionType.startsWith('support.'),
            reasonRequired: requiresReason,
            scopeRequired: requiresScope,
            durationOrExpiryRequired: requiresDurationOrExpiry,
            noSilentMembershipMutation: Boolean(input.context.noSilentMembershipMutation),
            redactionRequired: true,
        },
        beforeAfterPresent: {
            before: Boolean((input.context as Record<string, unknown>).before),
            after: Boolean((input.context as Record<string, unknown>).after),
        },
        links: {
            replay: auditFilterQuery(actionLinkFilters),
            request: input.event.request_id ? auditFilterQuery({ request: input.event.request_id }) : null,
            entity: input.entityId ? auditFilterQuery({ entity: input.entityId }) : null,
            supportSession: input.supportSessionId ? `/api/admin/support/sessions/${encodeURIComponent(input.supportSessionId)}` : null,
        },
        blockers: [
            requiresReason && !reason ? 'missing_reason_on_source_event' : '',
            requiresScope && !scope ? 'missing_scope_on_source_event' : '',
            requiresDurationOrExpiry && !durationMinutes && !expiresAt ? 'missing_duration_or_expiry_on_source_event' : '',
            'redaction_required',
        ].filter(Boolean),
        redacted: true,
        copyText: [
            `Support action evidence ${actionType || 'unknown'}`,
            `Outcome: ${input.event.outcome || 'unknown'}`,
            `Reason present: ${Boolean(reason)}`,
            `Request: ${input.event.request_id || 'none'}`,
            `Replay: ${auditFilterQuery(actionLinkFilters)}`,
        ].join('\n'),
    }
}
