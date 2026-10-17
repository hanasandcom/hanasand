import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { runInviteAccessListing } from './invite-access-listing.ts'
import { runInviteAcceptanceListing } from './invite-acceptance-listing.ts'
import { runOrganizationSettingsContract } from './organization-settings-contract.ts'

export async function runInviteListingAndSettings(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await runInviteAccessListing(ctx, journey)
    await runInviteAcceptanceListing(ctx, journey)
    await runOrganizationSettingsContract(ctx, journey)
}
