import { organizationTenantIdentity } from '../identity.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationWatchlistAlertGenerationContract, OrganizationSharedWatchlistDownstreamProof, OrganizationWatchlistAlertTermsExport } from '../types.ts'
import type { buildOrganizationActiveWatchlistTerms, buildOrganizationTermLifecycle } from './exportProjections.ts'
import type { OrganizationSharedWatchlistAlertQueueVisibility } from '../contracts/alertQueueVisibility.ts'

type Input = {
    organizationId: string
    member: { userId: string, role: OrganizationRole }
    activeTerms: ReturnType<typeof buildOrganizationActiveWatchlistTerms>
    termLifecycle: ReturnType<typeof buildOrganizationTermLifecycle>
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    sharedWatchlistDownstreamProof: OrganizationSharedWatchlistDownstreamProof
    sharedWatchlistAlertQueueVisibility: OrganizationSharedWatchlistAlertQueueVisibility
}

export function buildOrganizationAlertTermsReceipts(input: Input): Pick<OrganizationWatchlistAlertTermsExport, 'termExportDeltaReceipt' | 'alertCasePersistenceReceipt'> {
    const { organizationId, member, activeTerms, termLifecycle, alertGeneration, sharedWatchlistDownstreamProof, sharedWatchlistAlertQueueVisibility } = input
    const organization = { id: organizationId }
    const activeMemberActor = () => ({ userId: member.userId, role: member.role, status: 'active' as const })
    return {
        termExportDeltaReceipt: {
            schemaVersion: 'organization.watchlist_term_export_delta_receipt.v1',
            ...organizationTenantIdentity(organization.id, organization.id),
            actor: activeMemberActor(),
            route: 'GET /api/organizations/:id/watchlists/alert-terms',
            activeTermCount: activeTerms.length,
            exportedWatchlistItemIds: activeTerms.map(term => term.watchlistItemId),
            exportedAlertGeneratorKeys: activeTerms.map(term => term.alertGeneratorKey),
            excludedTermCount: termLifecycle.excludedFromAlertMatching.length,
            excludedWatchlistItemIds: termLifecycle.excludedFromAlertMatching.map(term => term.watchlistItemId),
            excludedReasons: Array.from(new Set(termLifecycle.excludedFromAlertMatching.map(term => term.blockerCode))),
            lifecycle: {
                activeItemIds: termLifecycle.activeItemIds,
                pausedItemIds: termLifecycle.pausedItemIds,
                archivedItemIds: termLifecycle.archivedItemIds,
                deletedTermIds: termLifecycle.deletedTermIds,
            },
            downstreamRefs: {
                alertGenerationConsumer: 'organization.watchlist_alert_generation_consumer.v1',
                alertPersistenceContract: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion,
                caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
                webhookOwnership: 'organization.shared_watchlist_webhook_ownership_hint.v1',
            },
            roleGates: {
                exportTerms: sharedWatchlistAlertQueueVisibility.visibility.allowedRoles,
                mutateWatchlists: ['owner', 'admin', 'editor'],
                readSharedWatchlists: ['owner', 'admin', 'editor', 'reader', 'member', 'viewer'],
            },
            blockerCodes: Array.from(new Set([
                ...alertGeneration.blockedReasons,
                ...termLifecycle.excludedFromAlertMatching.map(item => item.blockerCode),
            ])),
            stableDedupeFields: ['organizationId', 'watchlistItemId', 'termFamily', 'normalizedTerm'],
            nonmemberEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
        alertCasePersistenceReceipt: {
            schemaVersion: 'organization.alert_case_bridge_persistence_receipt.v1',
            ...organizationTenantIdentity(organization.id, organization.id),
            sourceFamily: 'organization_watchlist',
            alertPersistenceContract: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.schemaVersion,
            caseWorkflowContract: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.schemaVersion,
            storageModule: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.storageModule,
            alertUpsertFunction: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.upsertFunction,
            alertRoute: sharedWatchlistDownstreamProof.alertBridge.route,
            caseRoute: sharedWatchlistDownstreamProof.caseBridge.route,
            casePathTemplate: sharedWatchlistDownstreamProof.caseBridge.casePathTemplate,
            watchlistScope: {
                watchlistItemIds: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.watchlistItemIds,
                alertGeneratorKeys: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.watchlistScope.alertGeneratorKeys,
                crossTenantCollisionAllowed: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe.crossTenantCollisionAllowed,
            },
            requiredAlertFields: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.persistedAlertFields,
            requiredCaseFields: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.requiredCaseFields,
            workflowContextFields: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.workflowContextFields,
            dedupe: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.dedupe,
            lifecycleBlockers: sharedWatchlistDownstreamProof.alertBridge.persistenceContract.lifecycleBlockers,
            actorActions: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.actorActions.allowedActions,
            blockerCodes: Array.from(new Set([
                ...sharedWatchlistDownstreamProof.alertBridge.persistenceContract.blockerCodes,
                ...sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.blockerCodes,
            ])),
            noEnumeration: false,
            proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
        },
    }
}
