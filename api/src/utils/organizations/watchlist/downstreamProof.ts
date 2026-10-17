import { roleCanEditOrganization, type OrganizationRole } from '../../organizationRoles.ts'
import { organizationTenantIdentity } from '../identity.ts'
import { organizationWatchlistAlertGenerationRef } from './generationReferences.ts'
import { organizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { organizationSharedWatchlistAuditEventActions } from './auditContract.ts'
import { lifecycleOwnershipAuditSections } from './downstreamProof/lifecycleOwnershipAuditSections.ts'
import { alertBridgeSection } from './downstreamProof/alertBridgeSection.ts'
import { caseBridgeSection } from './downstreamProof/caseBridgeSection.ts'
import { webhookBridgeSection } from './downstreamProof/webhookBridgeSection.ts'
import { workflowSections } from './downstreamProof/workflowSections.ts'
import type { DownstreamProofInput, DownstreamProofContext } from './downstreamProof/context.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationDownstreamAuthorizationExport, OrganizationSharedWatchlistDownstreamProof, OrganizationWatchlistAlertBridgeBlockerCode, OrganizationWatchlistAlertGenerationContract } from '../types.ts'

export function organizationSharedWatchlistDownstreamProof(
    organization: Pick<OrganizationRow, 'id' | 'status' | 'pending_invite_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole },
    alertGeneration: OrganizationWatchlistAlertGenerationContract,
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
): OrganizationSharedWatchlistDownstreamProof {
    return organizationSharedWatchlistDownstreamProofFromProjection({
        organization,
        watchlistProjection: organizationWatchlistLifecycleProjection(items),
        member,
        alertGeneration,
        downstreamAuthorization,
    })
}

export function organizationSharedWatchlistDownstreamProofFromProjection(input: DownstreamProofInput): OrganizationSharedWatchlistDownstreamProof {
    const { organization, watchlistProjection, member, alertGeneration, downstreamAuthorization } = input
    const watchlistStates = watchlistProjection.terms
    const activeTerms = alertGeneration.activeWatchlistTerms
    const activeIds = [...downstreamAuthorization.watchlists.activeIds]
    const pausedIds = [...downstreamAuthorization.watchlists.pausedIds]
    const archivedIds = [...downstreamAuthorization.watchlists.archivedIds]
    const alertGeneratorKeys = activeTerms.map(term => organizationWatchlistAlertGenerationRef(term).dedupe.key)
    const alertBlockers = Array.from(new Set([
        ...alertGeneration.blockedReasons,
        ...downstreamAuthorization.downstream.alertGeneration.blockerCodes,
    ])) as OrganizationWatchlistAlertBridgeBlockerCode[]
    const caseBlockers: DownstreamProofContext['caseBlockers'] = Array.from(new Set([
        ...alertBlockers,
        ...(!downstreamAuthorization.allowedActions.includes('link_case') ? ['role_not_allowed' as const] : []),
    ]))
    const alertVisibilityDenialReason: DownstreamProofContext['alertVisibilityDenialReason'] = downstreamAuthorization.visibility.allowed
        ? (alertBlockers[0] ?? null)
        : downstreamAuthorization.visibility.reason
    const alertReadAllowed = downstreamAuthorization.visibility.allowed && alertBlockers.length === 0
    const caseWorkflowDenialReason: DownstreamProofContext['caseWorkflowDenialReason'] = downstreamAuthorization.visibility.allowed
        ? (caseBlockers[0] ?? null)
        : downstreamAuthorization.visibility.reason
    const caseReadAllowed = downstreamAuthorization.visibility.allowed && caseBlockers.length === 0
    const webhookBlockers: DownstreamProofContext['webhookBlockers'] = Array.from(new Set([
        ...alertBlockers,
        downstreamAuthorization.downstream.webhook.denialReason,
        downstreamAuthorization.downstream.webhook.canUseDefaultDestinations ? undefined : 'manual_webhook_selection_required',
    ].filter(Boolean).map(String)))
    const webhookDeliveryAllowedByRole = roleCanEditOrganization(member.role)
    const webhookPolicy = downstreamAuthorization.downstream.webhook.defaultPolicy
    const selectedDestinationSource = webhookPolicy === 'active_destinations' && downstreamAuthorization.downstream.webhook.canUseDefaultDestinations
        ? 'org_active_destinations'
        : webhookPolicy === 'disabled'
            ? 'webhook_policy_disabled'
            : 'manual_selection_required'
    const webhookManualDenialReason: DownstreamProofContext['webhookManualDenialReason'] = webhookDeliveryAllowedByRole
        ? (downstreamAuthorization.downstream.webhook.denialReason ?? (webhookPolicy === 'manual_selection' ? null : null))
        : 'role_not_allowed'
    const auditEventActions = [...organizationSharedWatchlistAuditEventActions]

    const context: DownstreamProofContext = { organization, watchlistProjection, member, alertGeneration, downstreamAuthorization, watchlistStates, activeTerms, activeIds, pausedIds, archivedIds, alertGeneratorKeys, alertBlockers, caseBlockers, alertVisibilityDenialReason, alertReadAllowed, caseWorkflowDenialReason, caseReadAllowed, webhookBlockers, webhookDeliveryAllowedByRole, webhookPolicy, selectedDestinationSource, webhookManualDenialReason, auditEventActions }

    return {
        schemaVersion: 'organization.shared_watchlist_downstream_proof.v1',
        ...organizationTenantIdentity(organization.id, organization.id),
        ...lifecycleOwnershipAuditSections(context),
        ...alertBridgeSection(context),
        ...caseBridgeSection(context),
        ...webhookBridgeSection(context),
        ...workflowSections(context),
    }
}
