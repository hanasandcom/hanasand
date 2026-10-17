import { organizationTenantIdentity } from '../identity.ts'
import { organizationAlertCaseRoleActions } from '../authorization/roleActions.ts'
import { alertCaseProofSections } from './alertCaseProofSections.ts'
import { webhookProofSections } from './webhookProofSections.ts'
import { memberInviteProofSections } from './memberInviteProofSections.ts'
import { cleanupWorkspaceProofSections } from './cleanupWorkspaceProofSections.ts'
import { alertUiProofSections } from './alertUiProofSections.ts'
import { customerAuditProofSections } from './customerAuditProofSections.ts'
import type { BuildOrganizationReadinessProofInput } from './context.ts'
import type { DownstreamProofContext } from '../watchlist/downstreamProof/context.ts'

function buildOrganizationReadinessProof(input: BuildOrganizationReadinessProofInput) {
    const watchlists = input.downstreamAuthorization.watchlists
    const actorCanExportActiveTerms = input.downstreamAuthorization.downstream.alertGeneration.canExportActiveTerms
    const organizationCanGenerateAlerts = input.alertGenerationBridge.canGenerateAlerts
    const cleanupRequired = watchlists.pausedCount + watchlists.archivedCount > 0
    const baseBlockerCodes = [
        ...input.lifecycleReadiness.typedBlockers,
        ...input.alertGenerationBridge.blockedReasons,
        ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
    ]
    const buildSortedBlockerCodes = (additionalBlockers: Array<string | null | undefined>) => Array.from(new Set([
        ...baseBlockerCodes,
        ...additionalBlockers,
    ].filter(Boolean).map(String))).sort()
    const blockers = buildSortedBlockerCodes([
        input.downstreamAuthorization.visibility.allowed ? undefined : input.downstreamAuthorization.visibility.reason,
        cleanupRequired ? 'cleanup_required' : undefined,
    ])
    const webhookBlockerCodes = [
        ...input.downstreamAuthorization.downstream.alertGeneration.blockerCodes,
        input.downstreamAuthorization.downstream.webhook.denialReason,
        input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations ? undefined : 'manual_webhook_selection_required',
    ].filter(Boolean).map(String)
    const webhookSelectedDestinationSource: DownstreamProofContext['selectedDestinationSource'] = input.downstreamAuthorization.downstream.webhook.defaultPolicy === 'active_destinations'
        && input.downstreamAuthorization.downstream.webhook.canUseDefaultDestinations
        ? 'org_active_destinations'
        : input.downstreamAuthorization.downstream.webhook.defaultPolicy === 'disabled'
            ? 'webhook_policy_disabled'
            : 'manual_selection_required'
    const acceptedOrInvitedCount = input.lifecycleReadiness.counts.activeMemberCount + input.lifecycleReadiness.counts.pendingInviteCount
    const tenMemberWorkspaceBlockers = Array.from(new Set([
        acceptedOrInvitedCount >= 10 ? undefined : 'needs_10_active_members_or_pending_invites',
        input.lifecycleReadiness.counts.sharedWatchlistCount > 0 ? undefined : 'needs_shared_watchlist_item',
        input.alertGenerationBridge.activeWatchlistTerms.length > 0 ? undefined : 'no_active_terms',
        input.lifecycleReadiness.lifecycleStatus === 'archived' ? 'org_archived' : undefined,
        input.lifecycleReadiness.lifecycleStatus === 'deleted' ? 'org_deleted' : undefined,
        input.downstreamAuthorization.member.status === 'active' ? undefined : 'member_revoked',
    ].filter(Boolean) as Array<'needs_10_active_members_or_pending_invites' | 'needs_shared_watchlist_item' | 'no_active_terms' | 'org_archived' | 'org_deleted' | 'member_revoked'>))
    const actorCaseActions = organizationAlertCaseRoleActions(input.downstreamAuthorization.member.role)
    const canAssignCase = actorCaseActions.includes('assign_case')
    const caseAssignmentBlockerCodes = buildSortedBlockerCodes([canAssignCase ? undefined : 'role_not_allowed'])
    const proofOrganizationLifecycleBlockerPrefix = () => ['org_archived', 'org_deleted', 'member_revoked'] as const
    const context = { input, watchlists, actorCanExportActiveTerms, organizationCanGenerateAlerts, cleanupRequired, blockers, webhookBlockerCodes, webhookSelectedDestinationSource, acceptedOrInvitedCount, tenMemberWorkspaceBlockers, actorCaseActions, canAssignCase, caseAssignmentBlockerCodes, buildSortedBlockerCodes, proofOrganizationLifecycleBlockerPrefix }
    const proof = {
        schemaVersion: 'organization.worker3_ui_readiness_proof.v1',
        ...organizationTenantIdentity(input.downstreamAuthorization.organizationId, input.downstreamAuthorization.tenantId),
        actor: {
            role: input.downstreamAuthorization.member.role,
            canExportActiveTerms: actorCanExportActiveTerms,
        },
        counts: {
            activeMemberCount: input.lifecycleReadiness.counts.activeMemberCount,
            activeAdminCount: input.lifecycleReadiness.counts.activeAdminCount,
            pendingInviteCount: input.lifecycleReadiness.counts.pendingInviteCount,
            activeWatchlistTermCount: input.alertGenerationBridge.activeWatchlistTerms.length,
            pausedWatchlistCount: watchlists.pausedCount,
            archivedWatchlistCount: watchlists.archivedCount,
        },
        readiness: {
            organizationCanGenerateAlerts,
            actorCanExportActiveTerms,
            readyForWorker3Replay: organizationCanGenerateAlerts && actorCanExportActiveTerms && !blockers.some(blocker => blocker.startsWith('org_') || blocker === 'no_active_admin' || blocker === 'no_active_terms' || blocker === 'alert_export_unavailable'),
            readyForDashboard: input.lifecycleReadiness.lifecycleStatus === 'active' && input.lifecycleReadiness.counts.activeAdminCount > 0,
            cleanupRequired,
        },
        routes: {
            createOrganization: 'POST /api/organizations',
            inviteMembers: 'POST /api/organizations/:id/invites',
            acceptInvite: 'POST /api/organizations/invites/:inviteId/accept',
            listWatchlists: 'GET /api/organizations/:id/watchlists',
            mutateWatchlist: 'POST|PUT|DELETE /api/organizations/:id/watchlists',
            alertReadiness: 'GET /api/organizations/:id/alert-readiness',
            alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
            cleanupWatchlists: 'POST /api/organizations/:id/watchlists/cleanup',
        },
        ...alertCaseProofSections(context),
        ...webhookProofSections(context),
        ...memberInviteProofSections(context),
        ...cleanupWorkspaceProofSections(context),
        ...alertUiProofSections(context),
        ...customerAuditProofSections(context),
        blockers,
    } as const

    return proof
}

type MutableDeep<T> = T extends readonly (infer Item)[]
    ? MutableDeep<Item>[]
    : T extends object
        ? { -readonly [Key in keyof T]: MutableDeep<T[Key]> }
        : T

type OrganizationReadinessProofBase = MutableDeep<ReturnType<typeof buildOrganizationReadinessProof>>

export type OrganizationReadinessProof = Omit<OrganizationReadinessProofBase, 'alertQueueProof'> & {
    alertQueueProof: Omit<OrganizationReadinessProofBase['alertQueueProof'], 'requiredQueryFields'> & {
        requiredQueryFields: ['organizationId']
    }
}

export function organizationReadinessProof(input: Parameters<typeof buildOrganizationReadinessProof>[0]): OrganizationReadinessProof {
    // Preserve the existing mutable-array surface while keeping the derived literal contract precise.
    return buildOrganizationReadinessProof(input) as unknown as OrganizationReadinessProof
}
