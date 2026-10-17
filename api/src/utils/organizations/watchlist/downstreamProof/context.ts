import type { OrganizationRole } from '../../../organizationRoles.ts'
import type { OrganizationRow } from '../../rowTypes.ts'
import type { OrganizationWatchlistLifecycleProjection } from '../lifecycleProjection.ts'
import type { OrganizationWatchlistAlertGenerationContract } from '../../contracts/alertGeneration.ts'
import type { OrganizationDownstreamAuthorizationExport } from '../../contracts/downstreamAuthorization.ts'
import type { OrganizationWatchlistAlertBridgeBlockerCode } from '../../contracts/alertBridge.ts'
import type { OrganizationSharedWatchlistAuditEventAction } from '../../inputTypes.ts'
import type { OrganizationSharedWatchlistDownstreamProof } from '../../contracts/downstreamProof.ts'

export type DownstreamProofInput = {
    organization: Pick<OrganizationRow, 'id' | 'status' | 'pending_invite_count' | 'default_webhook_policy' | 'alert_visibility_policy' | 'role'>
    watchlistProjection: OrganizationWatchlistLifecycleProjection
    member: { userId: string, role: OrganizationRole }
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
}

export type DownstreamProofContext = {
    organization: DownstreamProofInput['organization']
    watchlistProjection: OrganizationWatchlistLifecycleProjection
    member: DownstreamProofInput['member']
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
    watchlistStates: OrganizationWatchlistLifecycleProjection['terms']
    activeTerms: OrganizationWatchlistAlertGenerationContract['activeWatchlistTerms']
    activeIds: string[]
    pausedIds: string[]
    archivedIds: string[]
    alertGeneratorKeys: string[]
    alertBlockers: OrganizationWatchlistAlertBridgeBlockerCode[]
    caseBlockers: OrganizationSharedWatchlistDownstreamProof['caseBridge']['blockerCodes']
    alertVisibilityDenialReason: OrganizationSharedWatchlistDownstreamProof['alertBridge']['queueVisibilityContract']['actorVisibility']['denialReason']
    alertReadAllowed: boolean
    caseWorkflowDenialReason: OrganizationSharedWatchlistDownstreamProof['caseBridge']['caseWorkflowContract']['actorActions']['denialReason']
    caseReadAllowed: boolean
    webhookBlockers: OrganizationSharedWatchlistDownstreamProof['webhookBridge']['blockerCodes']
    webhookDeliveryAllowedByRole: boolean
    webhookPolicy: OrganizationDownstreamAuthorizationExport['downstream']['webhook']['defaultPolicy']
    selectedDestinationSource: 'org_active_destinations' | 'manual_selection_required' | 'webhook_policy_disabled'
    webhookManualDenialReason: OrganizationSharedWatchlistDownstreamProof['webhookBridge']['deliveryContract']['roleGates']['denialReason']
    auditEventActions: OrganizationSharedWatchlistAuditEventAction[]
}
