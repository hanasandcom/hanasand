import type { OrganizationAlertCaseAction } from '../inputTypes.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import { organizationTenantIdentity } from '../identity.ts'

export function organizationSharedWatchlistMonitoringWorkflow(input: {
    organizationId: string
    activeWatchlistItemIds: string[]
    alertGeneratorKeys: string[]
    alertAllowedRoles: OrganizationRole[]
    allowedActions: OrganizationAlertCaseAction[]
    alertReadAllowed: boolean
    caseReadAllowed: boolean
    webhookManualAllowed: boolean
    alertBlockers: string[]
    caseBlockers: string[]
    webhookBlockers: string[]
}): OrganizationSharedWatchlistDownstreamProof['monitoringWorkflow'] {
    const activeScopeReady = input.activeWatchlistItemIds.length > 0 && input.alertGeneratorKeys.length > 0
    const watchlistExportReady = activeScopeReady && input.alertBlockers.length === 0
    const alertUpsertReady = watchlistExportReady && input.alertReadAllowed
    const caseLinkReady = input.caseReadAllowed && input.allowedActions.includes('link_case') && input.caseBlockers.length === 0
    const webhookReady = input.webhookManualAllowed && input.webhookBlockers.length === 0
    const workflowBlockers = Array.from(new Set([
        ...input.alertBlockers,
        ...input.caseBlockers,
        ...input.webhookBlockers,
        ...(activeScopeReady ? [] : ['no_active_terms']),
    ])).sort()

    return {
        schemaVersion: 'organization.shared_watchlist_monitoring_workflow.v1',
        ...organizationTenantIdentity(input.organizationId, input.organizationId),
        sourceFamily: 'organization_watchlist',
        persistenceLevel: 'organization_persisted',
        expectedAdapter: 'organizationSharedWatchlistMonitoringWorkflow',
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        entrypoint: {
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            requiredQueryFields: ['organizationId', 'requestId'],
            responseField: 'alertTermsExport.sharedWatchlistDownstreamProof.monitoringWorkflow',
        },
        steps: [
            {
                id: 'watchlist_export',
                ownerLane: 'org_watchlist',
                route: 'GET /api/organizations/:id/watchlists/alert-terms',
                storageModule: 'api/src/utils/organizations.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'activeTerms[].alertGenerationRef', 'sharedWatchlistDownstreamProof.audit.eventBridge'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported', 'organization_watchlist_alert_terms_export_denied'],
                allowedRoles: input.alertAllowedRoles,
                state: watchlistExportReady ? 'ready' : 'blocked',
                blockerCodes: watchlistExportReady ? [] : Array.from(new Set([...input.alertBlockers, ...(activeScopeReady ? [] : ['no_active_terms'])])).sort(),
                redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'member.userId'],
            },
            {
                id: 'alert_upsert',
                ownerLane: 'dwm_alert_workflow',
                route: 'POST /v1/dwm/alerts/rebuild',
                storageModule: 'scraper/src/storage/dwmAlertRepository.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'workflowContext.alertGeneratorKeys', 'workflowContext.visibilityDecision', 'casePath'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: input.alertAllowedRoles,
                state: alertUpsertReady ? 'ready' : 'blocked',
                blockerCodes: alertUpsertReady ? [] : Array.from(new Set(input.alertBlockers.length ? input.alertBlockers : ['role_not_allowed'])).sort(),
                redactedFields: ['activeTerms[].term', 'activeTerms[].value'],
            },
            {
                id: 'alert_queue_visibility',
                ownerLane: 'dwm_alert_workflow',
                route: 'GET /v1/dwm/alerts',
                storageModule: 'scraper/src/storage/dwmAlertRepository.ts',
                requiredPayloadFields: ['organizationId', 'workflowContext.organizationId', 'workflowContext.alertGeneratorKeys', 'workflowContext.allowedActions'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported', 'organization_watchlist_alert_terms_export_denied'],
                allowedRoles: input.alertAllowedRoles,
                state: input.alertReadAllowed ? 'ready' : 'blocked',
                blockerCodes: input.alertReadAllowed ? [] : ['role_not_allowed'],
                redactedFields: ['activeTerms[].term', 'activeTerms[].value'],
            },
            {
                id: 'case_link',
                ownerLane: 'case_workflow',
                route: 'POST /v1/cases',
                storageModule: 'scraper/src/api/caseRoutes.ts',
                requiredPayloadFields: ['organizationId', 'tenantId', 'alertId', 'casePath', 'watchlistItemIds', 'evidence.provenance'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: ['owner', 'admin', 'editor', 'analyst'],
                state: caseLinkReady ? 'ready' : 'blocked',
                blockerCodes: caseLinkReady ? [] : Array.from(new Set(input.caseBlockers.length ? input.caseBlockers : ['role_not_allowed'])).sort(),
                redactedFields: ['activeTerms[].term', 'case.evidence.rawContent'],
            },
            {
                id: 'webhook_delivery',
                ownerLane: 'webhook_delivery',
                route: 'POST /v1/dwm/webhooks/deliver',
                storageModule: 'scraper/src/api/dwmWorkflowRoutes.ts',
                requiredPayloadFields: ['organizationId', 'destinationId', 'alert.dedupeKey', 'casePath', 'watchlistItemIds', 'auditEventContracts'],
                requiredAuditActions: ['organization_watchlist_alert_terms_exported'],
                allowedRoles: ['owner', 'admin'],
                state: webhookReady ? 'ready' : 'blocked',
                blockerCodes: webhookReady ? [] : Array.from(new Set(input.webhookBlockers.length ? input.webhookBlockers : ['manual_webhook_selection_required'])).sort(),
                redactedFields: ['activeTerms[].term', 'destination.secret'],
            },
        ],
        operatorActions: {
            acknowledgeAlert: input.allowedActions.includes('acknowledge_alert'),
            assignCase: input.caseReadAllowed && input.allowedActions.includes('assign_case'),
            linkCase: caseLinkReady,
            replayAlert: alertUpsertReady,
            deliverWebhook: webhookReady,
        },
        evidenceContract: {
            requiredFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'alertGeneratorKeys', 'casePath', 'audit.eventBridge', 'visibilityDecision'],
            redactedFields: ['activeTerms[].term', 'activeTerms[].value', 'destination.secret', 'case.evidence.rawContent'],
            containsRawTerms: false,
        },
        blockerCodes: workflowBlockers,
    }
}
