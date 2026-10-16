import { createOrganizationApiSmokeContext } from './organization-api-smoke/harness.ts'
import { runOrganizationCreationAndInitialInvite } from './organization-api-smoke/organization-creation-and-initial-invite.ts'
import { runInviteListingAndSettings } from './organization-api-smoke/invite-listing-and-settings.ts'
import { runInviteLifecycle } from './organization-api-smoke/invite-lifecycle.ts'
import { runMemberRolesAndWatchlists } from './organization-api-smoke/member-roles-and-watchlists.ts'
import { runAlertReadinessAndCaseVisibility } from './organization-api-smoke/alert-readiness-and-case-visibility.ts'
import { runAlertTermsExport } from './organization-api-smoke/alert-terms-export.ts'
import { runDownstreamContractsAndInviteDenials } from './organization-api-smoke/downstream-contracts-and-invite-denials.ts'
import { runOrganizationLifecycleAndTenantIsolation } from './organization-api-smoke/organization-lifecycle-and-tenant-isolation.ts'
import { runAlertReferenceAndActorLifecycle } from './organization-api-smoke/alert-reference-and-actor-lifecycle.ts'
import { runWatchlistCleanupAndRestore } from './organization-api-smoke/watchlist-cleanup-and-restore.ts'
import { runOwnershipRemovalAndOutsiderIsolation } from './organization-api-smoke/ownership-removal-and-outsider-isolation.ts'

const context = await createOrganizationApiSmokeContext()
try {
    const journey = await runOrganizationCreationAndInitialInvite(context)
    await runInviteListingAndSettings(context, journey)
    await runInviteLifecycle(context, journey)
    await runMemberRolesAndWatchlists(context, journey)
    await runAlertReadinessAndCaseVisibility(context, journey)
    await runAlertTermsExport(context, journey)
    await runDownstreamContractsAndInviteDenials(context, journey)
    await runOrganizationLifecycleAndTenantIsolation(context, journey)
    await runAlertReferenceAndActorLifecycle(context, journey)
    await runWatchlistCleanupAndRestore(context, journey)
    await runOwnershipRemovalAndOutsiderIsolation(context, journey)
} finally {
    await context.app.close()
}

console.log('Organization API smoke passed for role RBAC, invite lifecycle, shared watchlists, alert readiness, and outsider isolation.')
