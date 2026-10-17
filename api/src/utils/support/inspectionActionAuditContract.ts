import { auditFilterQuery, uniqueTimelineValues, type SupportInspectionPacket, type SupportTimelineFilter } from './inspectionPacketShared.ts'
import { supportText as text } from './adminSupportInput.ts'

export function supportInspectionActionAuditContract(input: {
    recoveryFixturePacket: Record<string, any>
    timelineFilter: SupportTimelineFilter
    organizationIds: string[]
    user: string
    email: string
    request: string
    supportSession: string
}): SupportInspectionPacket {
    const fixtures = Array.isArray(input.recoveryFixturePacket.fixtures) ? input.recoveryFixturePacket.fixtures : []
    const requestId = input.request || input.recoveryFixturePacket.audit?.expectedRequestId || 'support-request-id'
    const actionContracts = fixtures.map((fixture: Record<string, any>) => {
        const actionType = text(fixture.expectedAuditAction)
        const body = fixture.body && typeof fixture.body === 'object' ? fixture.body as Record<string, any> : {}
        const organizationId = text(body.organizationId || input.organizationIds[0])
        const targetId = text(body.targetUserId || body.email || input.user || input.email)
        const entityId = text(body.inviteId || body.targetUserId || body.email || targetId)
        const isImpersonation = actionType.startsWith('impersonation.')
        const isInvite = actionType.includes('invite')
        const isMember = actionType.includes('member')
        const targetType = isImpersonation ? 'user' : isInvite ? 'invite' : isMember ? 'member' : 'organization'
        const severity = isImpersonation || actionType.includes('access_recovery') ? 'warning' : 'notice'
        return {
            name: fixture.name || actionType || 'support_action',
            actionType,
            method: fixture.method || 'POST',
            route: fixture.route || null,
            available: Boolean(fixture.available),
            expectedOutcome: fixture.available ? 'success' : 'denied',
            severity,
            targetType,
            targetId: targetId || null,
            organizationId: organizationId || null,
            entityId: entityId || null,
            requiredReason: Boolean(body.reason),
            requiredContext: Boolean(body.context),
            requiredScope: Boolean(body.scope),
            requiredDurationOrExpiry: Boolean(body.durationMinutes || body.expiresAt),
            requiredIdempotency: Boolean(body.idempotencyKey || isImpersonation),
            requiredAuditFields: ['actionType', 'actorId', 'targetType', 'targetId', 'organizationId', 'entityId', 'requestId', 'severity', 'outcome', 'reason', 'context.schemaVersion', 'context.scope'],
            requiredContextFields: ['schemaVersion', 'requestId', 'supportContext', 'scope', 'supportSessionId', 'redactionRequired'],
            replay: {
                fixture: fixture.auditReplay || auditFilterQuery({ action: actionType, request: requestId, target: targetId }),
                success: auditFilterQuery({ action: actionType, request: requestId, outcome: 'success' }),
                denied: auditFilterQuery({ action: actionType, request: requestId, outcome: 'denied' }),
                target: targetId ? auditFilterQuery({ target: targetId, action: actionType }) : null,
            },
            creationPreview: {
                actionType,
                actorId: 'support-actor-id',
                targetType,
                targetId: targetId || 'target-id',
                organizationId: organizationId || null,
                entityId: entityId || targetId || null,
                requestId,
                severity,
                outcome: fixture.available ? 'success' : 'denied',
                reason: body.reason || 'Required support reason.',
                context: {
                    schemaVersion: actionType ? `${actionType}.audit.v1` : 'support.action.audit.v1',
                    requestId,
                    supportContext: body.context || 'Required support context.',
                    scope: body.scope || null,
                    supportSessionId: input.supportSession || body.supportSessionId || null,
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
            },
        }
    })
    const missingReasonActions = actionContracts.filter(contract => !contract.requiredReason).map(contract => contract.actionType)
    const missingContextActions = actionContracts.filter(contract => !contract.requiredContext).map(contract => contract.actionType)
    const missingScopeActions = actionContracts.filter(contract => !contract.requiredScope).map(contract => contract.actionType)
    return {
        schemaVersion: 'support.inspection.action_audit_contract.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        target: {
            organizationIds: input.organizationIds,
            userId: input.user || null,
            email: input.email || null,
            requestId: input.request || null,
            supportSessionId: input.supportSession || null,
        },
        actionContracts,
        requiredForEverySensitiveAction: {
            supportRole: true,
            reason: true,
            context: true,
            scope: true,
            requestId: true,
            actorIdentity: true,
            targetIdentity: true,
            immutableAuditEvent: true,
        },
        audit: {
            currentReplay: auditFilterQuery(input.timelineFilter),
            deniedReplay: auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' }),
            actionReplays: actionContracts.map(contract => contract.replay.fixture),
            expectedActions: uniqueTimelineValues(actionContracts.map(contract => contract.actionType)),
            expectedRequestId: requestId,
        },
        blockers: uniqueTimelineValues([
            actionContracts.length ? '' : 'missing_support_action_fixtures',
            missingReasonActions.length ? 'missing_reason_on_fixture' : '',
            missingContextActions.length ? 'missing_context_on_fixture' : '',
            missingScopeActions.length ? 'missing_scope_on_fixture' : '',
        ]),
        copyText: [
            `Support action audit contract request=${requestId}`,
            `Actions: ${uniqueTimelineValues(actionContracts.map(contract => contract.actionType)).join(', ') || 'none'}`,
            `Denied replay: ${auditFilterQuery({ ...input.timelineFilter, outcome: 'denied' })}`,
        ].join('\n'),
    }
}
