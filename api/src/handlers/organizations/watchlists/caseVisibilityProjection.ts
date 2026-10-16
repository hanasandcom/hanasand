import type {
    OrganizationRow,
    OrganizationDownstreamAuthorizationExport,
    OrganizationSharedWatchlistDownstreamProof,
    OrganizationVisibilityDecision,
} from '#utils/organizations.ts'
import { organizationAlertCaseVisibilityRoutes as routes } from './caseVisibilityRoutes.ts'

export function buildOrganizationAlertCaseVisibilityProjection(input: {
    organization: OrganizationRow
    userId: string
    visibility: OrganizationVisibilityDecision
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
    downstreamProof: OrganizationSharedWatchlistDownstreamProof
    analystPortalAdapter: ReturnType<typeof import('#utils/organizations.ts').organizationAnalystPortalVisibilityAdapter>
    alertCaseWorkflowState: ReturnType<typeof import('#utils/organizations.ts').organizationAlertCaseWorkflowState>
}) {
    const { organization, userId, visibility, downstreamAuthorization, downstreamProof, analystPortalAdapter, alertCaseWorkflowState } = input
    const alertQueue = downstreamProof.alertBridge.queueVisibilityContract
    const caseWorkflow = downstreamProof.caseBridge.caseWorkflowContract

    return {
        schemaVersion: 'organization.alert_case_visibility.v1',
        organizationId: organization.id,
        tenantId: organization.id,
        member: { userId, role: organization.role ?? 'viewer', status: 'active' },
        visibility,
        routes,
        requiredQueryFields: ['organizationId'],
        allowedActions: downstreamAuthorization.allowedActions,
        analystPortalAdapter,
        workflowState: alertCaseWorkflowState,
        alertQueue: {
            route: alertQueue.routes.list,
            requiredQueryFields: alertQueue.requiredQueryFields,
            watchlistItemIds: alertQueue.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: alertQueue.watchlistScope.alertGeneratorKeys,
            actionGates: alertQueue.actionGates,
            blockerCodes: alertQueue.blockerCodes,
        },
        caseWorkflow: {
            route: caseWorkflow.routes.list,
            casePathTemplate: caseWorkflow.casePathTemplate,
            requiredQueryFields: caseWorkflow.requiredQueryFields,
            watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
            alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
            actorActions: caseWorkflow.actorActions,
            blockerCodes: caseWorkflow.blockerCodes,
        },
        caseVisibilityConsumer: {
            schemaVersion: 'organization.case_visibility_consumer.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            sourceFamily: 'organization_watchlist',
            route: 'GET /api/organizations/:id/alert-case-visibility',
            downstreamRoutes: {
                caseList: caseWorkflow.routes.list,
                caseOpen: caseWorkflow.routes.open,
                caseDetail: caseWorkflow.routes.detail,
                caseUpdate: caseWorkflow.routes.update,
                alertList: alertQueue.routes.list,
            },
            requiredQueryFields: caseWorkflow.requiredQueryFields,
            casePathTemplate: caseWorkflow.casePathTemplate,
            member: {
                userId,
                role: organization.role ?? 'viewer',
                status: 'active',
                canReadCases: caseWorkflow.actorActions.canReadCases,
                canOpenCase: caseWorkflow.actorActions.canOpenCase,
                canAssignCase: caseWorkflow.actorActions.canAssignCase,
                denialReason: caseWorkflow.actorActions.denialReason,
            },
            watchlistScope: {
                ownerOrganizationId: organization.id,
                watchlistItemIds: caseWorkflow.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: caseWorkflow.watchlistScope.alertGeneratorKeys,
                evidenceRefField: caseWorkflow.watchlistScope.evidenceRefField,
                crossTenantCollisionAllowed: false,
                lifecycleStatuses: ['active'],
            },
            requiredPersistedFields: [
                'organizationId', 'tenantId', 'alertId', 'casePath', 'watchlistItemIds',
                'alertGeneratorKeys', 'allowedActions', 'visibilityDecision', 'evidence.provenance',
            ],
            denialContract: {
                statusCode: 403,
                nonmemberEnumeration: false,
                redactedFields: ['activeTerms[]', 'watchlistScope.alertGeneratorKeys', 'case.evidence.rawContent', 'otherOrg.caseIds'],
                blockerCodes: caseWorkflow.blockerCodes,
            },
            noLeakFields: ['otherOrg.watchlistItemIds', 'otherOrg.alertGeneratorKeys', 'otherOrg.caseIds', 'case.evidence.rawContent'],
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        alertCasePersistenceReadiness: {
            schemaVersion: 'organization.alert_case_persistence_readiness.v1',
            organizationId: organization.id,
            tenantId: organization.id,
            sourceFamily: 'organization_watchlist',
            alertPersistenceContract: downstreamProof.alertBridge.persistenceContract.schemaVersion,
            caseWorkflowContract: caseWorkflow.schemaVersion,
            storageModule: downstreamProof.alertBridge.persistenceContract.storageModule,
            alertUpsertFunction: downstreamProof.alertBridge.persistenceContract.upsertFunction,
            alertRoute: downstreamProof.alertBridge.route,
            caseRoute: downstreamProof.caseBridge.route,
            casePathTemplate: caseWorkflow.casePathTemplate,
            watchlistScope: {
                watchlistItemIds: downstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: downstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys,
                crossTenantCollisionAllowed: downstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed,
            },
            requiredAlertFields: downstreamProof.alertBridge.persistenceContract.persistedAlertFields,
            requiredCaseFields: caseWorkflow.requiredCaseFields,
            workflowContextFields: downstreamProof.alertBridge.persistenceContract.workflowContextFields,
            dedupe: downstreamProof.alertBridge.persistenceContract.dedupe,
            lifecycleBlockers: downstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
            actorActions: caseWorkflow.actorActions.allowedActions,
            blockerCodes: Array.from(new Set([
                ...downstreamProof.alertBridge.persistenceContract.blockerCodes,
                ...caseWorkflow.blockerCodes,
            ])),
            readyForPersistence: downstreamProof.alertBridge.persistenceContract.blockerCodes.length === 0 && caseWorkflow.blockerCodes.length === 0,
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        guardrails: {
            schemaVersion: 'organization.alert_case_visibility_guardrails.v1',
            partitionKey: 'organizationId',
            tenantIdField: 'tenantId',
            requiredWorkflowContextFields: ['organizationId', 'tenantId', 'watchlistItemIds', 'workflowContext.visibilityDecision'],
            crossTenantCollisionAllowed: false,
            nonmemberEnumeration: false,
            noLeakFields: ['otherOrg.watchlistItemIds', 'otherOrg.alertGeneratorKeys', 'case.evidence.rawContent', 'destination.secret'],
            lifecycleBlockers: downstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
        },
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}
