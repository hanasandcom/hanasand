import type { OrganizationApiSmokeContext, OrganizationSmokeJourney } from './harness.ts'
import { assertOrganizationArchived } from './organization-lifecycle-archive.ts'
import { assertOrganizationDeletedAndReactivated } from './organization-lifecycle-delete.ts'
import { createSecondOrganizationFixture } from './organization-tenant-fixture.ts'
import { assertSecondOrganizationAlertProofs } from './organization-tenant-alert-proof.ts'
import { assertSecondOrganizationTenantBoundaries } from './organization-tenant-boundaries.ts'

export async function runOrganizationLifecycleAndTenantIsolation(ctx: OrganizationApiSmokeContext, journey: OrganizationSmokeJourney): Promise<void> {
    await assertOrganizationArchived(ctx, journey)
    await assertOrganizationDeletedAndReactivated(ctx, journey)
    const fixture = await createSecondOrganizationFixture(ctx, journey)
    assertSecondOrganizationAlertProofs(ctx, journey, fixture.secondOrganization, fixture.secondOrgWatchlistItem, fixture.secondOrgAlertTermsExport)
    await assertSecondOrganizationTenantBoundaries(ctx, journey, fixture.secondOrganization, fixture.secondOrgWatchlistItem, fixture.secondOrgAlertTermsExport)
}
