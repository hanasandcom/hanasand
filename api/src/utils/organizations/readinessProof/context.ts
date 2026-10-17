import type { WebhookDestinationSelectionSource } from '../../webhookDestinationReadinessBridge.ts'
import type { OrganizationLifecycleReadiness } from '../contracts/lifecycleReadiness.ts'
import type { OrganizationWatchlistAlertGenerationContract } from '../contracts/alertGeneration.ts'
import type { OrganizationDownstreamAuthorizationExport } from '../contracts/downstreamAuthorization.ts'

export type BuildOrganizationReadinessProofInput = {
    lifecycleReadiness: OrganizationLifecycleReadiness
    alertGenerationBridge: OrganizationWatchlistAlertGenerationContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
}

export type ReadinessProofContext = {
    input: BuildOrganizationReadinessProofInput
    watchlists: OrganizationDownstreamAuthorizationExport['watchlists']
    actorCanExportActiveTerms: boolean
    organizationCanGenerateAlerts: boolean
    cleanupRequired: boolean
    blockers: string[]
    webhookBlockerCodes: string[]
    webhookSelectedDestinationSource: WebhookDestinationSelectionSource
    acceptedOrInvitedCount: number
    tenMemberWorkspaceBlockers: string[]
    actorCaseActions: OrganizationDownstreamAuthorizationExport['allowedActions']
    canAssignCase: boolean
    caseAssignmentBlockerCodes: string[]
    buildSortedBlockerCodes: (additionalBlockers: Array<string | null | undefined>) => string[]
    proofOrganizationLifecycleBlockerPrefix: () => readonly ['org_archived', 'org_deleted', 'member_revoked']
}
