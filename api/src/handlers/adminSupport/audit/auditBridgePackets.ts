import { supportText as text } from '#utils/support/adminSupportInput.ts'
import { auditFilterQuery } from '#utils/support/inspectionPackets.ts'
import { systemEventFilters } from './auditFilterDefinitions.ts'

export function supportAuditBridgeAdapterContract(filters: Record<string, unknown>) {
    const filterFields = Array.from(systemEventFilters)
    return {
        schemaVersion: 'support.audit.bridge_adapter_contract.v1',
        route: '/api/admin/audit-events',
        adapter: 'supportTimelineAuditBridgeEvent',
        supportedWorkflows: ['organization', 'watchlist', 'webhook', 'alert', 'impersonation', 'support'],
        requiredFields: [
            'workflow',
            'action',
            'actorId',
            'targetType',
            'targetId',
            'organizationId',
            'entityId',
            'requestId',
            'severity',
            'outcome',
            'reason',
        ],
        filterFields,
        supportAliases: {
            actor: ['actor', 'actorId', 'supportActor', 'supportActorId'],
            organization: ['org', 'orgId', 'organizationId'],
            target: ['target', 'targetId', 'user', 'userId', 'targetUserId'],
            request: ['request', 'requestId', 'correlation', 'correlationId'],
            entity: ['entity', 'entityId', 'entityType'],
            workflow: ['workflow', 'bridgeWorkflow', 'sourceWorkflow'],
            supportSession: ['session', 'supportSession', 'supportSessionId'],
            blocker: ['blocker', 'blockerCode'],
            reason: ['reason', 'supportReason'],
            scope: ['scope', 'supportScope'],
            context: ['context', 'supportContext'],
        },
        currentFilters: filters,
        redaction: {
            required: true,
            redactedFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', 'session', 'credential', 'webhookUrl', 'privateSourceUrl'],
            beforeAfterRedacted: true,
        },
        blockerCatalog: [
            'missing_support_reason',
            'unsupported_audit_filter',
            'audit_unavailable',
            'redaction_required',
        ],
        replay: {
            query: auditFilterQuery(filters),
            detailRouteTemplate: '/api/admin/audit-events/:id',
        },
        controlledRecoveryFixtures: supportControlledRecoveryAuditFixtures(filters),
        worker3: {
            readinessName: 'support-audit-bridge-adapter',
            testCommand: 'cd api && bun run smoke:admin-support-unit',
            expectedResponsePath: 'detail.bridgeAdapter',
            validation: [
                'detail.bridgeAdapter.schemaVersion = support.audit.bridge_adapter_contract.v1',
                'detail.bridgeAdapter.supportedWorkflows includes webhook and alert',
                'detail.bridgeAdapter.redaction.required = true',
                'detail.bridgeAdapter.replay.query is copy-ready',
            ],
        },
    }
}

export function supportControlledRecoveryAuditFixtures(filters: Record<string, unknown>) {
    const organizationId = text(filters.org) || 'organization-id'
    const actorId = text(filters.actor) || 'support-actor-id'
    const targetId = text(filters.target) || 'target-user-or-email'
    const requestId = text(filters.request) || 'support-request-id'
    return {
        schemaVersion: 'support.audit.controlled_recovery_fixtures.v1',
        generatedAt: new Date().toISOString(),
        redacted: true,
        purpose: 'org_invite_access_recovery_audit_integration',
        requiredEventFields: [
            'actionType',
            'actorId',
            'targetType',
            'targetId',
            'organizationId',
            'entityId',
            'requestId',
            'severity',
            'outcome',
            'reason',
            'context.schemaVersion',
            'context.scope',
            'context.idempotencyKey',
        ],
        fixtures: [
            {
                name: 'invite_resend_allowed',
                actionType: 'support.organization.invite_resend',
                severity: 'notice',
                outcome: 'success',
                targetType: 'invite',
                targetId,
                organizationId,
                entityId: 'invite-id',
                actorId,
                requestId,
                reason: 'Verified customer request to resend pending invite.',
                context: {
                    schemaVersion: 'support.action_execute.invite_action.v1',
                    action: 'resend',
                    scope: ['invite:resend'],
                    idempotencyKey: 'support-invite-resend-key',
                    correlationId: 'support-correlation-id',
                    supportSessionId: 'support-session-id',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.invite_resend', outcome: 'success', entity: 'invite-id', request: requestId }),
            },
            {
                name: 'access_recovery_pending_approval',
                actionType: 'support.organization.access_recovery',
                severity: 'warning',
                outcome: 'success',
                targetType: 'invite',
                targetId,
                organizationId,
                entityId: 'invite-id',
                actorId,
                requestId,
                reason: 'Verified customer cannot reach an organization admin.',
                context: {
                    schemaVersion: 'support.access_recovery.v1',
                    approvalRequired: true,
                    approvalStatus: 'pending',
                    scope: ['recovery:invite'],
                    expiresAt: 'future ISO timestamp',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.access_recovery', outcome: 'success', request: requestId }),
            },
            {
                name: 'member_role_recovery_denied',
                actionType: 'support.organization.member_role_recovery',
                severity: 'warning',
                outcome: 'denied',
                targetType: 'user',
                targetId,
                organizationId,
                entityId: targetId,
                actorId,
                requestId,
                reason: 'Support attempted role recovery without sufficient org condition.',
                context: {
                    schemaVersion: 'support.action_execute.member_role_recovery.v1',
                    blockerCode: 'active_admin_available',
                    scope: ['member:role_recovery'],
                    idempotencyKey: 'support-member-role-key',
                    noSilentMembershipMutation: true,
                    redactionRequired: true,
                },
                replay: auditFilterQuery({ org: organizationId, action: 'support.organization.member_role_recovery', outcome: 'denied', target: targetId, request: requestId }),
            },
        ],
        filterExpectations: {
            byOrganization: auditFilterQuery({ org: organizationId, source: 'admin', service: 'hanasand-api' }),
            byRequest: auditFilterQuery({ request: requestId }),
            byTarget: auditFilterQuery({ target: targetId }),
            deniedOnly: auditFilterQuery({ org: organizationId, outcome: 'denied', source: 'admin', service: 'hanasand-api' }),
            recoveryOnly: auditFilterQuery({ org: organizationId, action: 'access_recovery', source: 'admin', service: 'hanasand-api' }),
        },
        redaction: {
            beforeAfterRedacted: true,
            forbiddenFields: ['token', 'secret', 'authorization', 'cookie', 'webhookUrl', 'privateSourceUrl'],
        },
    }
}
