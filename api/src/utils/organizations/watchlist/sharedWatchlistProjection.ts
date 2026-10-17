import type { OrganizationRole } from '../../organizationRoles.ts'
import type { OrganizationRow, OrganizationWatchlistRow } from '../rowTypes.ts'
import type { OrganizationDownstreamAuthorizationExport, OrganizationSharedWatchlistDownstreamProof, OrganizationWatchlistAlertGenerationContract } from '../types.ts'
import { organizationWatchlistLifecycleProjection, type OrganizationWatchlistLifecycleProjection } from './lifecycleProjection.ts'
import { organizationWatchlistAlertGenerationContractFromProjection } from './alertGenerationContract.ts'
import { organizationDownstreamAuthorizationExportFromProjection } from './downstreamAuthorization.ts'
import { organizationSharedWatchlistDownstreamProofFromProjection } from './downstreamProof.ts'

export type OrganizationSharedWatchlistProjection = {
    alertGeneration: OrganizationWatchlistAlertGenerationContract
    downstreamAuthorization: OrganizationDownstreamAuthorizationExport
    sharedWatchlistDownstreamProof: OrganizationSharedWatchlistDownstreamProof
}

type OrganizationSharedWatchlistProjectionInput = Pick<OrganizationRow,
    'id' | 'name' | 'slug' | 'status' | 'member_count' | 'owner_count' | 'admin_count'
    | 'pending_invite_count' | 'shared_watchlist_count' | 'default_webhook_policy'
    | 'alert_visibility_policy' | 'role'
>

export function organizationSharedWatchlistProjection(
    organization: OrganizationSharedWatchlistProjectionInput,
    items: OrganizationWatchlistRow[],
    member: { userId: string, role: OrganizationRole }
): OrganizationSharedWatchlistProjection {
    return organizationSharedWatchlistProjectionFromLifecycle(
        organization,
        organizationWatchlistLifecycleProjection(items),
        member
    )
}

export function organizationSharedWatchlistProjectionFromLifecycle(
    organization: OrganizationSharedWatchlistProjectionInput,
    watchlistProjection: OrganizationWatchlistLifecycleProjection,
    member: { userId: string, role: OrganizationRole }
): OrganizationSharedWatchlistProjection {
    const alertGeneration = organizationWatchlistAlertGenerationContractFromProjection(organization, watchlistProjection)
    const downstreamAuthorization = organizationDownstreamAuthorizationExportFromProjection(organization, watchlistProjection, member)
    const sharedWatchlistDownstreamProof = organizationSharedWatchlistDownstreamProofFromProjection({
        organization,
        watchlistProjection,
        member,
        alertGeneration,
        downstreamAuthorization,
    })
    return { alertGeneration, downstreamAuthorization, sharedWatchlistDownstreamProof }
}
