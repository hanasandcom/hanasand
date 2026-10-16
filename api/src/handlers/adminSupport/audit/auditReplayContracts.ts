import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'

export function supportAuditTimelineReplayContract(filters: Record<string, unknown>, timeline: Array<Record<string, any>>) {
    const replayQuery = auditFilterQuery(filters)
    return {
        schemaVersion: 'support.audit.timeline_replay_contract.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        route: '/api/admin/audit-events',
        detailRouteTemplate: '/api/admin/audit-events/:id',
        supportedFilters: {
            org: ['org', 'orgId', 'organizationId'],
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            action: ['action', 'actionType'],
            workflow: ['workflow', 'bridgeWorkflow', 'sourceWorkflow'],
            severity: ['severity'],
            time: ['from', 'to'],
            entity: ['entity', 'entityId', 'entityType'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            outcome: ['outcome'],
            query: ['q'],
            reason: ['reason', 'supportReason'],
            scope: ['scope', 'supportScope'],
        },
        replay: {
            query: replayQuery,
            filters,
            eventIds: timeline.map(event => event.id).filter((id): id is number => Number.isFinite(id)),
            detailRoutes: timeline.map(event => event.links?.detail).filter(Boolean),
        },
        timelineShape: {
            requiredFields: ['id', 'timestamp', 'actionType', 'severity', 'outcome', 'actor.id', 'target.id', 'organization.id', 'entity.id', 'requestId', 'reason', 'actionEvidence'],
            detailPayloads: ['filterContract', 'exportProof', 'compliancePacket', 'workflowProof', 'integrationFixture', 'timelineReplayContract', 'caseReplayExport', 'supportWorkflowPacket', 'actionEvidenceRollup'],
            redactionRequired: true,
        },
        exampleQueries: {
            organization: auditFilterQuery({ org: filters.org || 'organization-id' }),
            actor: auditFilterQuery({ actor: filters.actor || 'support-actor-id' }),
            target: auditFilterQuery({ target: filters.target || 'target-user-id' }),
            actionOutcome: auditFilterQuery({ action: filters.action || 'support.organization.access_recovery', outcome: filters.outcome || 'success' }),
            entity: auditFilterQuery({ entity: filters.entity || 'entity-id', entityType: filters.entityType || 'invite' }),
            request: auditFilterQuery({ request: filters.request || 'request-id' }),
            timeRange: auditFilterQuery({ from: filters.from || '2026-01-01T00:00:00.000Z', to: filters.to || '2026-01-02T00:00:00.000Z' }),
            textQuery: auditFilterQuery({ q: filters.q || 'customer@example.com' }),
        },
        denialReplay: {
            schemaVersion: 'support.audit.denial_replay.v1',
            supportedOutcomes: ['success', 'denied', 'failed'],
            deniedActionQuery: auditFilterQuery({ action: filters.action || 'support.organization.access_recovery', outcome: 'denied', org: filters.org || '' }),
            missingReasonQuery: auditFilterQuery({ action: filters.action || 'support', outcome: filters.outcome || 'denied', reason: '' }),
            requiredAuditFields: ['actor.id', 'target.id', 'organization.id', 'actionType', 'outcome', 'reason', 'requestId'],
            expectedDeniedActions: [
                'support.inspect',
                'support.organization.invite_assist',
                'support.organization.invite_resend',
                'support.organization.invite_revoke',
                'support.organization.member_role_recovery',
                'support.organization.access_recovery',
                'impersonation.start',
            ],
            redactionRequired: true,
        },
        integrationReadiness: {
            fixtureName: 'support-audit-timeline-replay',
            expectedResponsePath: 'detail.timelineReplayContract',
            focusedCheck: 'cd api && bun run smoke:admin-support-unit',
            apiTypecheck: 'cd api && ./node_modules/.bin/tsc --noEmit --pretty false',
            validation: [
                'detail.timelineReplayContract.schemaVersion = support.audit.timeline_replay_contract.v1',
                'detail.timelineReplayContract.replay.eventIds contains returned audit event ids',
                'detail.timelineReplayContract.exampleQueries.actionOutcome is copy-ready',
                'detail.timelineReplayContract.timelineShape.redactionRequired = true',
            ],
        },
        blockers: [
            timeline.length ? '' : 'audit_unavailable',
            replayQuery.includes('?') ? '' : 'missing_replay_filter',
        ].filter(Boolean),
        copyText: [
            'Support audit timeline replay',
            `Replay: ${replayQuery}`,
            `Events: ${timeline.map(event => event.id).filter(Boolean).join(', ') || 'none'}`,
        ].join('\n'),
    }
}

export function supportAuditEventIntegrationFixture(input: {
    detail: Record<string, any>
    timelineEvent: Record<string, any>
    relatedTimeline: Array<Record<string, any>>
    filters: Record<string, unknown>
}) {
    const links = input.timelineEvent.links?.entities || {}
    const organizationId = text(input.detail.organizationId || input.filters.org)
    const targetId = text(input.detail.targetId || input.filters.target)
    const entityId = text(input.detail.entityId || input.filters.entity)
    const requestId = text(input.detail.requestId || input.filters.request)
    const actionType = text(input.detail.actionType)
    const outcome = text(input.detail.outcome)
    const relatedEventIds = input.relatedTimeline.map(event => event.id).filter((id): id is number => Number.isFinite(id))
    return {
        schemaVersion: 'support.audit.integration_fixture.v1',
        fixtureName: 'support-audit-detail-timeline',
        generatedAt: new Date().toISOString(),
        redacted: true,
        noMutation: true,
        seedEntities: {
            organizationId: organizationId || null,
            targetId: targetId || null,
            entityId: entityId || null,
            requestId: requestId || null,
            actionType: actionType || null,
            outcome: outcome || null,
        },
        auditFilters: {
            detail: `/api/admin/audit-events/${encodeURIComponent(String(input.timelineEvent.id || 'event-id'))}`,
            replay: auditFilterQuery(input.filters),
            request: requestId ? auditFilterQuery({ request: requestId }) : null,
            entity: entityId ? auditFilterQuery({ entity: entityId }) : null,
            outcome: outcome ? auditFilterQuery({ outcome, action: actionType }) : null,
        },
        supportRoutes: {
            inspection: links.inspection || null,
            inviteAction: links.inviteAction || null,
            accessRecovery: links.accessRecovery || null,
            memberRoleRecovery: links.memberRoleRecovery || null,
            impersonation: links.impersonation || null,
            supportSession: links.supportSession || null,
        },
        expectedAuditFields: [
            'actor.id',
            'target.id',
            'organization.id',
            'entity.id',
            'actionType',
            'severity',
            'outcome',
            'requestId',
            'reason',
            'timestamp',
            'actionEvidence',
        ],
        assertions: {
            reasonRequiredForSupportActions: true,
            scopeRequiredForMutationActions: true,
            durationRequiredForImpersonation: true,
            redactionRequired: true,
            relatedEventIds,
            expectedOutcome: outcome || null,
            expectedActionType: actionType || null,
        },
        blockers: [
            organizationId || targetId || entityId ? '' : 'missing_structured_target',
            requestId ? '' : 'missing_request_id',
            actionType ? '' : 'missing_action_type',
        ].filter(Boolean),
        copyText: [
            'Support audit integration fixture',
            `Action: ${actionType || 'unknown'}`,
            `Outcome: ${outcome || 'unknown'}`,
            `Request: ${requestId || 'none'}`,
            `Replay: ${auditFilterQuery(input.filters)}`,
            `Related events: ${relatedEventIds.join(', ') || 'none'}`,
        ].join('\n'),
    }
}
