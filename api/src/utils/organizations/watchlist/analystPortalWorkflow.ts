import type { OrganizationAlertCaseAction, OrganizationSharedWatchlistAuditEventAction } from '../inputTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import { roleCanEditOrganization } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationSharedWatchlistAnalystPortalWorkflow(input: {
    organizationId: string
    actorRole: OrganizationRole
    alertReadAllowed: boolean
    caseReadAllowed: boolean
    webhookManualAllowed: boolean
    allowedActions: OrganizationAlertCaseAction[]
    alertBlockers: string[]
    caseBlockers: string[]
    webhookBlockers: string[]
    auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
}): OrganizationSharedWatchlistDownstreamProof['analystPortalWorkflow'] {
    const canAcknowledge = input.alertReadAllowed && input.allowedActions.includes('acknowledge_alert')
    const canAssignCase = input.caseReadAllowed && input.allowedActions.includes('assign_case')
    const canLinkCase = input.caseReadAllowed && input.allowedActions.includes('link_case')
    const canReplay = input.alertReadAllowed && roleCanEditOrganization(input.actorRole) && input.alertBlockers.length === 0
    const canDeliverWebhook = input.webhookManualAllowed && input.webhookBlockers.length === 0
    const portalBlockers = Array.from(new Set([
        ...(input.alertReadAllowed ? [] : ['role_not_allowed']),
        ...input.alertBlockers,
        ...input.caseBlockers,
        ...input.webhookBlockers,
    ])).sort()
    const eventActions = [
        'organization_watchlist_alert_terms_exported',
        'organization_watchlist_alert_terms_export_denied',
        'organization_lifecycle_mutation_blocked',
    ] as OrganizationSharedWatchlistAuditEventAction[]
    const redactedTimelineFields: OrganizationSharedWatchlistDownstreamProof['analystPortalWorkflow']['timelineContract']['redactedFields'] = [
        'metadata.value',
        'metadata.email',
        'activeTerms[].term',
        'alertBridge.alertGeneratorKeys',
    ]

    return {
        schemaVersion: 'organization.shared_watchlist_analyst_portal_workflow.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        sourceFamily: 'organization_watchlist',
        expectedAdapter: 'organizationSharedWatchlistAnalystPortalWorkflow',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        queueContract: {
            route: 'GET /v1/dwm/alerts',
            requiredQueryFields: ['organizationId'],
            storageModule: 'scraper/src/storage/dwmAlertRepository.ts',
            itemFields: ['alertId', 'organizationId', 'watchlistItemIds', 'severity', 'status', 'casePath', 'updatedAt', 'allowedActions'],
            state: input.alertReadAllowed ? 'ready' : 'blocked',
            blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
        },
        detailContract: {
            route: 'GET /v1/dwm/alerts/:id',
            evidenceFields: ['capturedAt', 'source', 'watchlistItemIds', 'alertGeneratorKeys', 'casePath', 'workflowEvents', 'audit.eventBridge'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'case.evidence.rawContent', 'destination.secret'],
            containsRawTerms: false,
        },
        actionContracts: [
            {
                action: 'review_alert',
                route: 'GET /v1/dwm/alerts/:id',
                method: 'GET',
                requiredRoles: ['owner', 'admin', 'editor'],
                allowed: input.alertReadAllowed,
                requiredPayloadFields: ['organizationId', 'alertId'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
            },
            {
                action: 'acknowledge_alert',
                route: 'PATCH /v1/dwm/alerts/:id',
                method: 'PATCH',
                requiredRoles: ['owner', 'admin', 'editor', 'analyst'],
                allowed: canAcknowledge,
                requiredPayloadFields: ['organizationId', 'alertId', 'rationale'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canAcknowledge ? [] : ['role_not_allowed'],
            },
            {
                action: 'assign_case',
                route: 'PATCH /v1/cases/:id',
                method: 'PATCH',
                requiredRoles: ['owner', 'admin', 'editor', 'analyst'],
                allowed: canAssignCase,
                requiredPayloadFields: ['organizationId', 'caseId', 'assigneeId', 'rationale'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canAssignCase ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'link_case',
                route: 'POST /v1/cases',
                method: 'POST',
                requiredRoles: ['owner', 'admin', 'editor', 'analyst'],
                allowed: canLinkCase,
                requiredPayloadFields: ['organizationId', 'alertId', 'watchlistItemIds', 'casePath'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canLinkCase ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'replay_alert',
                route: 'POST /v1/dwm/alerts/:id/replay',
                method: 'POST',
                requiredRoles: ['owner', 'admin', 'editor'],
                allowed: canReplay,
                requiredPayloadFields: ['organizationId', 'alertId', 'watchlistItemIds'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canReplay ? [] : Array.from(new Set(input.alertBlockers.length ? input.alertBlockers : ['role_not_allowed'])).sort(),
            },
            {
                action: 'deliver_webhook',
                route: 'POST /v1/dwm/webhooks/deliver',
                method: 'POST',
                requiredRoles: ['owner', 'admin', 'editor'],
                allowed: canDeliverWebhook,
                requiredPayloadFields: ['organizationId', 'alertId', 'destinationId', 'idempotencyKey'],
                auditEventActions: ['organization_watchlist_alert_terms_exported'],
                blockerCodes: canDeliverWebhook ? [] : Array.from(new Set(input.webhookBlockers.length ? input.webhookBlockers : ['manual_webhook_selection_required'])).sort(),
            },
            {
                action: 'open_audit_timeline',
                route: 'GET /api/admin/support/audit',
                method: 'GET',
                requiredRoles: ['owner', 'admin', 'support'],
                allowed: input.auditEventActions.includes('organization_watchlist_alert_terms_exported'),
                requiredPayloadFields: ['organizationId', 'requestId'],
                auditEventActions: eventActions,
                blockerCodes: input.auditEventActions.includes('organization_watchlist_alert_terms_exported') ? [] : ['missing_required_action'],
            },
        ],
        timelineContract: {
            route: 'GET /api/admin/support/audit',
            source: 'events',
            requiredEventBridge: 'organization.shared_watchlist_audit_event_bridge.v1',
            eventActions,
            redactedFields: redactedTimelineFields,
        },
        roleGate: {
            actorRole: input.actorRole,
            readAlertsAllowed: input.alertReadAllowed,
            mutateAllowed: canAcknowledge || canReplay,
            caseActionsAllowed: canAssignCase || canLinkCase,
            webhookDeliveryAllowed: canDeliverWebhook,
        },
        blockerCodes: portalBlockers,
    }
}
