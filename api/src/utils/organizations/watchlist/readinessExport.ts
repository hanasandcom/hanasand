import type { OrganizationSharedWatchlistConsumerReadiness } from '../contracts/consumerAdapters.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../contracts/downstreamProof.ts'
import type { OrganizationWatchlistAlertTermsExport } from '../contracts/watchlistExport.ts'
import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationRow } from '../types.ts'
import { organizationTenantIdentity } from '../identity.ts'

type ReadinessExportInput = {
    organization: Pick<OrganizationRow, 'id'>
    member: { userId: string, role: OrganizationRole }
    consumerReadiness: OrganizationSharedWatchlistConsumerReadiness
    sharedWatchlistDownstreamProof: OrganizationSharedWatchlistDownstreamProof
    alertGenerationConsumer: OrganizationWatchlistAlertTermsExport['alertGenerationConsumer']
    alertCasePersistenceReceipt: OrganizationWatchlistAlertTermsExport['alertCasePersistenceReceipt']
    webhookDestinationOwnership: OrganizationWatchlistAlertTermsExport['webhookDestinationOwnership']
    webhookDestinationAccessDecision: OrganizationWatchlistAlertTermsExport['webhookDestinationAccessDecision']
    termExportDeltaReceipt: OrganizationWatchlistAlertTermsExport['termExportDeltaReceipt']
    termLifecycle: OrganizationWatchlistAlertTermsExport['termLifecycle']
}

export function buildOrganizationReadinessExport(input: ReadinessExportInput): OrganizationWatchlistAlertTermsExport['readinessExport'] {
    const {
        organization, member,
        consumerReadiness, sharedWatchlistDownstreamProof, alertGenerationConsumer,
        alertCasePersistenceReceipt, webhookDestinationOwnership, webhookDestinationAccessDecision,
        termExportDeltaReceipt, termLifecycle,
    } = input
    const activeMemberActor = () => ({ userId: member.userId, role: member.role, status: 'active' as const })
    return {
        schemaVersion: 'organization.shared_watchlist_readiness_export.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        sourceFamily: 'organization_watchlist',
        actor: activeMemberActor(),
        routes: {
            alertTermsExport: consumerReadiness.routes.alertTermsExport,
            alertQueue: consumerReadiness.routes.alertList,
            caseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
            caseOpen: sharedWatchlistDownstreamProof.caseBridge.caseWorkflowContract.routes.open,
            webhookDeliver: consumerReadiness.routes.webhookDeliver,
            dashboardReadiness: consumerReadiness.routes.dashboardReadiness,
        },
        readiness: {
            alertExportReady: alertGenerationConsumer.canGenerateAlerts && alertGenerationConsumer.blockerCodes.length === 0,
            alertQueueReady: consumerReadiness.readiness.alertQueueReady,
            casePersistenceReady: alertCasePersistenceReceipt.blockerCodes.length === 0,
            caseVisibilityReady: consumerReadiness.readiness.caseWorkflowReady,
            webhookDestinationReady: webhookDestinationAccessDecision.blockerCodes.length === 0,
            supportRedactedReadReady: consumerReadiness.readiness.supportRedactedReadReady,
            dashboardReadinessReady: consumerReadiness.readiness.dashboardReadinessReady,
        },
        watchlistScope: {
            activeItemIds: termLifecycle.activeItemIds,
            pausedItemIds: termLifecycle.pausedItemIds,
            archivedItemIds: termLifecycle.archivedItemIds,
            alertGeneratorKeys: consumerReadiness.watchlists.alertGeneratorKeys,
            crossTenantCollisionAllowed: false,
        },
        userLocalIsolation: {
            schemaVersion: 'organization.user_local_watchlist_isolation.v1',
            sourceOfTruth: 'organization_watchlist_items',
            organizationScopeField: 'organization_id',
            requiredQueryFields: ['organizationId'],
            excludedSources: ['user_local_watchlists', 'session_watchlists', 'demo_watchlists'],
            forbiddenFallbacks: ['userId_only', 'session_only', 'missing_organization_id'],
            activeWatchlistItemIds: termLifecycle.activeItemIds,
            alertGeneratorKeys: consumerReadiness.watchlists.alertGeneratorKeys,
            crossOrgDedupeAllowed: false,
            nonmemberEnumeration: false,
            noLeakFields: ['otherOrg.watchlistItemIds', 'otherOrg.alertGeneratorKeys', 'userLocal.watchlistItems', 'session.watchlistItems'],
            proofAssertions: ['requires_org_id', 'two_org_overlapping_terms_distinct_keys', 'nonmember_cannot_enumerate_terms', 'removed_member_cannot_export_terms'],
        },
        downstreamRefs: {
            alertGenerationConsumer: alertGenerationConsumer.schemaVersion,
            alertPersistenceReceipt: alertCasePersistenceReceipt.schemaVersion,
            caseVisibilityConsumer: 'organization.case_visibility_consumer.v1',
            webhookDestinationOwnership: webhookDestinationOwnership.schemaVersion,
            webhookDestinationAccessDecision: webhookDestinationAccessDecision.schemaVersion,
            termExportDeltaReceipt: termExportDeltaReceipt.schemaVersion,
        },
        roleGates: {
            exportTerms: consumerReadiness.roleGates.exportTerms,
            mutateWatchlists: consumerReadiness.roleGates.mutateWatchlists,
            manualWebhookTrigger: consumerReadiness.roleGates.manualWebhookTrigger,
            assignCase: consumerReadiness.roleGates.assignCase,
        },
        lifecycleAccess: {
            activeMembershipRequired: true,
            removedMemberBlocker: 'member_revoked',
            revokedInviteBlocker: 'member_revoked',
            expiredInviteBlocker: 'invite_expired',
            pausedWatchlistBlocker: 'watchlist_paused',
            archivedWatchlistBlocker: 'watchlist_archived',
            nonmemberEnumeration: false,
        },
        blockers: Array.from(new Set([
            ...consumerReadiness.blockers,
            ...alertGenerationConsumer.blockerCodes,
            ...alertCasePersistenceReceipt.blockerCodes.map(String),
            ...webhookDestinationAccessDecision.blockerCodes,
        ])),
        noLeakFields: ['activeTerms[].term', 'otherOrg.watchlistItemIds', 'otherOrg.alertGeneratorKeys', 'destination.secret', 'case.evidence.rawContent'],
        proofCommand: 'cd api && bun scripts/smoke-organizations-api.ts',
    }
}
