import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { runMemberRoleContract } from './member-role-contract.ts'
import { runWatchlistMemberContracts } from './watchlist-member-contracts.ts'
import { runWatchlistRoleDenials } from './watchlist-role-denials.ts'
import { runWatchlistLifecycle } from './watchlist-lifecycle.ts'

export async function runMemberRolesAndWatchlists(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await runMemberRoleContract(ctx, journey)
    await runWatchlistMemberContracts(ctx, journey)
    await runWatchlistRoleDenials(ctx, journey)
    await runWatchlistLifecycle(ctx, journey)
}
